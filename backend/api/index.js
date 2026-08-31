// Điểm vào của serverless function trên Vercel.
// Vercel gọi handler dạng (req, res) — bản thân Express app chính là hàm như vậy,
// nên chỉ cần export lại app đã cấu hình sẵn ở ../index.js.
export { default } from '../index.js';
