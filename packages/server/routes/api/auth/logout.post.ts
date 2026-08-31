import { defineEventHandler } from "h3";
import { logout } from "../../../services/auth";
export default defineEventHandler((event) => { logout(event); return { ok: true, data: { loggedOut: true } }; });
