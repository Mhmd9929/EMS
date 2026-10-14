import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    sessionVersion?: number;
    authTime?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    sv?: number;
    authTime?: number;
  }
}
