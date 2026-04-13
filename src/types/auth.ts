export enum Role {
  COLLECTOR = 'COLLECTOR',
  COORDINATOR = 'COORDINATOR',
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  accepted: boolean;
  created_at: string;
}

export interface AuthSession {
  jwt: string;
  user: User;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  display_name: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: User; jwt: string };
