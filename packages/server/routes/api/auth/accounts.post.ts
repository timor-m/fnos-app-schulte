import { defineEventHandler, readBody } from "h3"; import { createAccount } from "../../../services/auth";
export default defineEventHandler(async (event) => { try { const body=await readBody<{username?:string}>(event); return {ok:true,data:createAccount(event,String(body?.username||""))}; } catch(e) { return {ok:false,error:{message:e instanceof Error?e.message:"创建失败"}}; } });
