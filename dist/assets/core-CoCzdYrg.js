import{j as T,D as x,E as w}from"./vite-index-B5AAHvdc.js";import{D as y,i as N}from"./aiModels-C7sdIpRX.js";const v=`
Bạn là Chuyên gia Xử lý Dữ Liệu Báo Cáo Nghị Định Thư Montreal (Data Extraction Specialist).
Nhiệm vụ: Phân tích hình ảnh các trang báo cáo (PDF scan hoặc điện tử) và trích xuất dữ liệu chính xác tuyệt đối vào cấu trúc JSON dưới đây.

LƯU Ý QUAN TRỌNG VỀ DỮ LIỆU:
1.  **Checkbox (Lĩnh vực hoạt động):** Tìm các ô có dấu "x", "v", hoặc "✓". Nếu thấy, trả về true.
2.  **Bảng 2.1:** Phân biệt rõ "Hạn ngạch phân bổ" và "Hạn ngạch điều chỉnh". Cột "Số tờ khai" (Customs Decl No) là bắt buộc.
3.  **Bảng 2.3:** Phải chia tách dữ liệu vào 2 nhóm dựa trên tiêu đề phụ trong bảng: "Máy điều hòa..." và "Thiết bị lạnh công nghiệp...".
4.  **Giá trị rỗng:** Nếu ô trống hoặc không có thông tin, trả về null (đừng bịa số liệu).

--- JSON SCHEMA BẮT BUỘC ---
{
  "thong_tin_chung": {
    "ten_to_chuc": "String (Lấy chính xác tên in hoa, VD: CÔNG TY TNHH...)",
    "ma_so_doanh_nghiep": "String (Ưu tiên lấy từ dòng: Số, ký hiệu của giấy phép đăng ký kinh doanh, hoạt động hoặc quyết định thành lập; nếu không có thì lấy từ Mã số thuế/Mã số doanh nghiệp)",
    "ngay_cap": "String (Định dạng DD/MM/YYYY)",
    "noi_cap": "String",
    "nguoi_dai_dien": "String",
    "chuc_vu": "String",
    "nguoi_lien_he": "String",
    "dia_chi_lien_he": "String",
    "dien_thoai": "String",
    "email": "String"
  },
  "linh_vuc_hoat_dong": {
    "san_xuat_chat": boolean,
    "nhap_khau_chat": boolean,
    "xuat_khau_chat": boolean,
    "san_xuat_thiet_bi": boolean,
    "nhap_khau_thiet_bi": boolean,
    "so_huu_dieu_hoa_lon": boolean,
    "so_huu_thiet_bi_lanh_cn": boolean,
    "thu_gom_tai_che": boolean
  },
  "bang_2_1": {
    "san_xuat": [],
    "nhap_khau": [
      {
        "ten_chat": "String (VD: HFC-32, R-410A)",
        "ma_hs": "String",
        "han_ngach_phan_bo_kg": Number,
        "han_ngach_dieu_chinh_kg": Number,
        "tong_su_dung_kg": Number,
        "gia_trung_binh": "String",
        "noi_xuat_nhap": "String",
        "dang_ky_nam_sau_kg": Number
      }
    ],
    "xuat_khau": []
  },
  "bang_2_2": [
    {
       "loai_san_pham": "String (Tên thiết bị/Số hiệu)",
       "ma_hs": "String",
       "nang_suat_lanh": "String",
       "so_luong": Number,
       "ten_chat": "String",
       "luong_chat_trong_don_vi_kg": Number
    }
  ],
  "bang_2_3": {
     "dieu_hoa_lon": [
        {
           "loai_thiet_bi": "String",
           "so_luong": Number,
           "ten_chat": "String",
           "luong_chat_trong_thiet_bi_kg": Number,
           "nang_suat_lanh": "String",
           "nam_su_dung": "String",
           "tan_suat_nap_moi": "String",
           "luong_nap_moi_kg": Number
        }
     ],
     "thiet_bi_lanh_cn": [
     ]
  },
  "bang_2_4": [
    {
       "ten_chat": "String",
       "thu_gom_kg": Number,
       "dia_diem_thu_gom": "String",
       "tai_su_dung_kg": Number,
       "cong_nghe_tai_su_dung": "String",
       "tai_che_kg": Number,
       "cong_nghe_tai_che": "String",
       "tieu_huy_kg": Number,
       "cong_nghe_tieu_huy": "String"
    }
  ]
}
`;function G({apiKey:c,images:a,proxyUrl:t,model:o,systemPrompt:g,maxOutputTokens:m,includePageLabels:f}){const i=[{text:g&&String(g).trim()?String(g):v}];a.forEach(h=>{f&&h&&h.page!==void 0&&h.page!==null&&i.push({text:`[PAGE ${h.page}]`}),i.push({inline_data:{mime_type:h.mime||"image/jpeg",data:h.data}})});const d={contents:[{role:"user",parts:i}],generationConfig:{temperature:0,maxOutputTokens:Number.isFinite(m)?Number(m):8192,responseMimeType:"application/json",response_mime_type:"application/json"}};let e=o&&String(o).trim()?String(o).trim():y;return N(e)||(console.warn(`[Gemini] Invalid model "${e}", falling back to ${y}`),e=y),t&&String(t).trim()?{url:String(t).trim(),payload:{apiKey:c,model:e,payload:d}}:{url:x(e,c),payload:d}}async function j({apiKey:c,images:a,proxyUrl:t,model:o,systemPrompt:g,maxOutputTokens:m,includePageLabels:f}){if(!c)throw new Error("Chưa cấu hình API Key (Gemini) trong Cài đặt");if(!Array.isArray(a)||a.length===0)throw new Error("Không có ảnh trang PDF để gửi lên AI");const _=G({apiKey:c,images:a,proxyUrl:t,model:o,systemPrompt:g,maxOutputTokens:m,includePageLabels:f});let i;try{i=await fetch(_.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_.payload)})}catch(e){const h=e&&(e.message||e.stack)?e.message||e.stack:String(e),b=t&&String(t).trim()?"Kiểm tra Gemini Proxy URL trong Cài đặt (đúng định dạng, đúng port, server đang chạy) và kết nối mạng.":"Nếu gọi trực tiếp từ trình duyệt bị chặn (CORS/mạng), hãy cấu hình Gemini Proxy URL trong Cài đặt để gọi qua proxy.";throw new Error(`Không thể kết nối tới Gemini (${_.url}). ${h}. ${b}`)}if(!i.ok){const e=await i.text().catch(()=>"");throw new Error(`Gemini HTTP ${i.status}: ${e||i.statusText}`)}return await i.json()}function A({apiKey:c,proxyUrl:a,model:t,systemPrompt:o,userPrompt:g,temperature:m,maxOutputTokens:f}){let _=t&&String(t).trim()?String(t).trim():y;N(_)||(console.warn(`[Gemini] Invalid model "${_}", falling back to ${y}`),_=y);const i=String(o).trim()?String(o):"",d=g&&String(g).trim()?String(g):"",h={contents:[{role:"user",parts:[...i?[{text:i}]:[],{text:d}]}],generationConfig:{temperature:m,maxOutputTokens:f}};if(a&&String(a).trim())return{url:String(a).trim(),body:h};if(!c||!String(c).trim())throw new Error("Thiếu API Key Gemini (hoặc cấu hình Proxy URL).");return{url:x(_,String(c).trim()),body:h}}function C(c){const a=c&&c.data?c.data:c,t=a&&a.candidates&&a.candidates[0]&&a.candidates[0].content&&a.candidates[0].content.parts;return Array.isArray(t)?t.map(o=>o&&typeof o.text=="string"?o.text:"").join(`
`).trim():""}async function M({apiKey:c,proxyUrl:a,model:t,systemPrompt:o,userPrompt:g,temperature:m,maxOutputTokens:f}){const _=A({apiKey:c,proxyUrl:a,model:t,systemPrompt:o,userPrompt:g,temperature:m,maxOutputTokens:f}),i=await fetch(_.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(_.body)});if(!i.ok){const h=await i.text().catch(()=>""),b=a&&String(a).trim()?"Kiểm tra Proxy URL và nhật ký server proxy.":"Kiểm tra API Key, model, và kết nối mạng/CORS.";throw new Error("Gemini API error: "+i.status+" "+i.statusText+(h?" - "+h.slice(0,400):"")+" | "+b)}const d=await i.json(),e=C(d);return{json:d,text:e}}function P(c){let t=String(c||"").replace(/```[a-zA-Z]*\n?/g,"").replace(/```/g,"").replace(/\u2028|\u2029/g,"");const o=t.indexOf("{"),g=t.indexOf("[");let m=-1;if(o!==-1&&g!==-1?m=Math.min(o,g):m=o!==-1?o:g,m===-1)throw new Error("No JSON object/array found in AI output");t=t.slice(m).trim();const f=n=>n.replace(/,\s*([}\]])/g,"$1").replace(/\u0000/g,"").trim(),_=n=>{const r=[];let l=!1,p=!1,S="";for(let s=0;s<n.length;s++){const u=n[s];if(l){p?p=!1:u==="\\"?p=!0:u===S&&(l=!1);continue}if(u==='"'||u==="'"){l=!0,S=u;continue}if(u==="{"||u==="[")r.push(u);else if(u==="}"||u==="]"){const k=r[r.length-1];(u==="}"&&k==="{"||u==="]"&&k==="[")&&r.pop()}}return r},i=n=>{const r=_(n);if(!r.length)return n;let l=n;for(let p=r.length-1;p>=0;p--)l+=r[p]==="{"?"}":"]";return l},d=n=>{const r=f(n),l=JSON.parse(r);return w(l)};try{return d(t)}catch{}try{return d(i(t))}catch{}const e=[],h=Math.max(0,t.length-2e4);for(let n=h;n<t.length;n++){const r=t[n];(r==="}"||r==="]")&&e.push(n)}for(let n=e.length-1;n>=0;n--){const r=e[n],l=t.slice(0,r+1),p=i(l);try{return d(p)}catch{}}let b=-1;{const n=[];let r=!1,l=!1,p="";for(let S=0;S<t.length;S++){const s=t[S];if(r){l?l=!1:s==="\\"?l=!0:s===p&&(r=!1);continue}if(s==='"'||s==="'"){r=!0,p=s;continue}if(s==="{"||s==="[")n.push(s);else if(s==="}"||s==="]"){const u=n[n.length-1];(s==="}"&&u==="{"||s==="]"&&u==="[")&&(n.pop(),n.length===0&&(b=S))}}}if(b!==-1){const n=t.slice(0,b+1);try{return d(n)}catch{}}try{T("error","parseGeminiJson_failed",{message:"Invalid JSON returned from AI (unable to repair)",sample:String(text||"").slice(0,4e3)})}catch{}throw new Error("Invalid JSON returned from AI (unable to repair)")}export{M as a,j as c,P as p};
