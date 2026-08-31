import { defineEventHandler, readBody } from "h3"; import { resetPassword } from "../../../../services/auth";
export default defineEventHandler(async (event) => { try { const body=await readBody<{uid?:string}>(event); return {ok:true,data:resetPassword(event,String(body?.uid||""))}; } catch(e) { return {ok:false,error:{message:e instanceof Error?e.message:"重置失败"}}; } });
