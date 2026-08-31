import { defineEventHandler } from "h3"; import { listAccounts } from "../../../services/auth";
export default defineEventHandler((event) => { try { return {ok:true,data:listAccounts(event)}; } catch(e) { return {ok:false,error:{message:e instanceof Error?e.message:"无权限"}}; } });
