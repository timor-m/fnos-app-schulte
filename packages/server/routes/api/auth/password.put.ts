import { defineEventHandler, readBody } from "h3";
import { changePassword } from "../../../services/auth";
export default defineEventHandler(async (event) => { try { const body=await readBody<{password?:string}>(event); changePassword(event,String(body?.password||"")); return {ok:true,data:{changed:true}}; } catch (e) { return {ok:false,error:{message:e instanceof Error?e.message:"修改密码失败"}}; } });
