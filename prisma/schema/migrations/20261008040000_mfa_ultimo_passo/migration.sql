-- FC-15: último passo TOTP aceito por usuário (recusa reuso do mesmo código na janela).
ALTER TABLE "usuarios" ADD COLUMN "mfaUltimoPasso" INTEGER;
