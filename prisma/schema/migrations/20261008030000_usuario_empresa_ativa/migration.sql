-- FC-06: empresa ativa persistida por usuário (login, refresh e MFA a mantêm).
ALTER TABLE "usuarios" ADD COLUMN "empresaAtivaId" UUID;
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_empresaAtivaId_fkey" FOREIGN KEY ("empresaAtivaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
