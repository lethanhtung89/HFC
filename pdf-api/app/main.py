import base64
import hashlib
import os
import re
from typing import Any, Dict, List, Tuple

import fitz  # PyMuPDF
import orjson
import pytesseract
import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from io import BytesIO

DATA_DIR = os.getenv("DATA_DIR", "/data")
TESS_LANG = os.getenv("TESSERACT_LANG", "vie+eng")

# Không default model: buộc client/UI gửi model
SERVER_GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()

app = FastAPI(title="PDF Extract API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def _gemini_url(model: str, api_key: str) -> str:
    m = (model or "").strip()
    if not m:
        raise ValueError("Missing model")
    model_path = m if m.startswith("models/") else f"models/{m}"
    return f"https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent?key={api_key}"

def _json_load_loose(s: str) -> Any:
    s = (s or "").strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s)
    try:
        return orjson.loads(s)
    except Exception:
        pass
    m = re.search(r"(\{.*\}|\[.*\])", s, flags=re.DOTALL)
    if not m:
        raise ValueError("No JSON object/array found in model output.")
    return orjson.loads(m.group(1))

def _call_gemini(payload: Dict[str, Any], model: str, api_key: str, timeout_s: int) -> Dict[str, Any]:
    url = _gemini_url(model, api_key)
    r = requests.post(url, json=payload, timeout=timeout_s)
    if not r.ok:
        raise HTTPException(status_code=502, detail=f"Gemini HTTP {r.status_code}: {r.text[:2000]}")
    return r.json()

def _render_page_png(doc: fitz.Document, page_index: int, zoom: float = 2.0) -> bytes:
    page = doc.load_page(page_index)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return pix.tobytes("png")

def _ocr_png(png_bytes: bytes) -> str:
    img = Image.open(BytesIO(png_bytes)).convert("RGB")
    return pytesseract.image_to_string(img, lang=TESS_LANG)

def _extract_text_per_page(doc: fitz.Document) -> List[str]:
    out = []
    for i in range(doc.page_count):
        t = doc.load_page(i).get_text("text") or ""
        out.append(t.strip())
    return out

def _pick_pages_by_keywords(text_pages: List[str], patterns: List[str], fallback_n: int) -> List[int]:
    idx = []
    rx = [re.compile(p, re.IGNORECASE) for p in patterns]
    for i, t in enumerate(text_pages):
        if not t:
            continue
        if any(r.search(t) for r in rx):
            idx.append(i)
    if idx:
        return sorted(set(idx))
    return list(range(min(fallback_n, len(text_pages))))

def _build_report_prompt() -> str:
    return (
        "Trích xuất dữ liệu từ PDF báo cáo quản lý/tiêu thụ HCFC/HFC.\n"
        "Trả về JSON object duy nhất, KHÔNG kèm giải thích.\n"
        "Yêu cầu: giữ đầy đủ bảng, không bỏ sót dòng; số liệu phải là số.\n"
        "Schema:\n"
        "{\n"
        "  \"thong_tin_chung\": {\"ten_doanh_nghiep\": \"\", \"ma_so_thue\": \"\", \"dia_chi\": \"\", \"nam_bao_cao\": \"\"},\n"
        "  \"linh_vuc_hoat_dong\": {\"san_xuat\": false, \"nhap_khau\": false, \"xuat_khau\": false, \"thu_hoi\": false, \"tai_che\": false, \"tieu_huy\": false, \"khac\": \"\"},\n"
        "  \"bang_2_1\": [],\n"
        "  \"bang_2_2\": [],\n"
        "  \"bang_2_3\": [],\n"
        "  \"bang_2_4\": []\n"
        "}\n"
        "Các bảng là mảng dòng; mỗi dòng giữ các cột đúng như PDF.\n"
    )

def _build_customs_prompt() -> str:
    return (
        "Trích xuất các dòng tờ khai hải quan liên quan môi chất lạnh/HCFC/HFC.\n"
        "Trả về JSON array, mỗi phần tử là 1 dòng hàng hoá.\n"
        "Không suy diễn; nếu ô trống thì để \"\".\n"
        "Schema mỗi phần tử:\n"
        "{\n"
        "  \"so_to_khai\": \"\",\n"
        "  \"ngay_dang_ky\": \"\",\n"
        "  \"ma_hs\": \"\",\n"
        "  \"mo_ta_hang\": \"\",\n"
        "  \"ten_moi_chat\": \"\",\n"
        "  \"khoi_luong\": 0,\n"
        "  \"don_vi\": \"\",\n"
        "  \"ghi_chu\": \"\"\n"
        "}\n"
    )

def _make_parts_from_pages(doc: fitz.Document, pages: List[int], text_pages: List[str]) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    images = []
    text_buf = []
    ocr_used = 0

    for i in pages:
        t = text_pages[i] if i < len(text_pages) else ""
        if t:
            text_buf.append(f"[PAGE {i+1} TEXT]\n{t}")

        png = _render_page_png(doc, i, zoom=2.0)

        if (not t) or (len(t) < 40):
            try:
                o = _ocr_png(png)
                if o.strip():
                    text_buf.append(f"[PAGE {i+1} OCR]\n{o.strip()}")
                    ocr_used += 1
            except Exception:
                pass

        images.append({
            "inline_data": {
                "mime_type": "image/png",
                "data": base64.b64encode(png).decode("ascii"),
            }
        })

    meta = {"pages": [p + 1 for p in pages], "ocr_used_pages": ocr_used, "images": len(images)}
    return "\n\n".join(text_buf), images, meta

@app.get("/api/health")
def health():
    return {"ok": True, "service": "pdf-api", "version": app.version}

@app.post("/api/gemini")
async def gemini_proxy(body: Dict[str, Any]):
    api_key = (body.get("apiKey") or "").strip() or SERVER_GEMINI_KEY
    model = (body.get("model") or "").strip()
    payload = body.get("payload")

    if not api_key:
        raise HTTPException(status_code=400, detail="Missing apiKey (body.apiKey or GEMINI_API_KEY env).")
    if not model:
        raise HTTPException(status_code=400, detail="Missing model (select in UI).")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="payload must be an object.")

    data = _call_gemini(payload, model=model, api_key=api_key, timeout_s=300)
    return {"data": data}

@app.post("/api/extract/report")
async def extract_report(
    file: UploadFile = File(...),
    model: str = Form(""),
    apiKey: str = Form(""),
):
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    model = (model or "").strip()
    if not model:
        raise HTTPException(status_code=400, detail="Missing model (select in UI).")

    api_key = (apiKey or "").strip() or SERVER_GEMINI_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing apiKey (form apiKey or GEMINI_API_KEY env).")

    sha = _sha256(pdf_bytes)

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    text_pages = _extract_text_per_page(doc)
    pages = _pick_pages_by_keywords(
        text_pages,
        patterns=[r"bảng\s*2\.1", r"bảng\s*2\.2", r"bảng\s*2\.3", r"bảng\s*2\.4", r"thông\s*tin\s*chung", r"báo\s*cáo"],
        fallback_n=min(10, doc.page_count),
    )

    source_text, images, meta_pages = _make_parts_from_pages(doc, pages, text_pages)

    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": _build_report_prompt()}, {"text": source_text}] + images
        }],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}
    }

    raw = _call_gemini(payload, model=model, api_key=api_key, timeout_s=450)

    try:
        txt = raw["candidates"][0]["content"]["parts"][0].get("text", "") or ""
    except Exception:
        txt = orjson.dumps(raw).decode("utf-8", errors="ignore")

    try:
        parsed = _json_load_loose(txt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Model returned non-JSON: {e}")

    return {
        "reportData": parsed,
        "meta": {
            "sha256": sha,
            "pages_used": meta_pages,
            "model": model,
            "filename": file.filename,
            "text_pages_nonempty": sum(1 for t in text_pages if t),
        },
        "raw": raw,
    }

@app.post("/api/extract/customs")
async def extract_customs(
    file: UploadFile = File(...),
    model: str = Form(""),
    apiKey: str = Form(""),
):
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    model = (model or "").strip()
    if not model:
        raise HTTPException(status_code=400, detail="Missing model (select in UI).")

    api_key = (apiKey or "").strip() or SERVER_GEMINI_KEY
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing apiKey (form apiKey or GEMINI_API_KEY env).")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    text_pages = _extract_text_per_page(doc)
    pages = list(range(min(doc.page_count, 6)))
    source_text, images, meta_pages = _make_parts_from_pages(doc, pages, text_pages)

    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": _build_customs_prompt()}, {"text": source_text}] + images
        }],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}
    }

    raw = _call_gemini(payload, model=model, api_key=api_key, timeout_s=450)

    try:
        txt = raw["candidates"][0]["content"]["parts"][0].get("text", "") or ""
    except Exception:
        txt = orjson.dumps(raw).decode("utf-8", errors="ignore")

    try:
        parsed = _json_load_loose(txt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Model returned non-JSON: {e}")

    if not isinstance(parsed, list):
        raise HTTPException(status_code=502, detail="Expected JSON array for customs extraction.")

    return {"items": parsed, "meta": {"pages_used": meta_pages, "model": model, "filename": file.filename}, "raw": raw}
