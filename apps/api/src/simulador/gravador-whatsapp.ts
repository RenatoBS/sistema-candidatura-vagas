import { FakeWhatsappProvider } from '@scv/providers';

/** Uma instância no processo da API. Grava o que seria enviado à Uazapi e não faz HTTP. */
export const gravadorSimulador = new FakeWhatsappProvider();
