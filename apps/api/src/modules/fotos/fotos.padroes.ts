/**
 * BE-FOT-01 · Poses padrão do sistema: frente, perfil e costas.
 *
 * Mesmos ids e dados do seed DB-021 (prisma/seeds/0021_modelos_e_poses_padrao),
 * onde ficam com profissional_id NULL. Servem de BASE: cada profissional
 * recebe uma cópia delas na primeira vez que usa as fotos e, a partir daí,
 * adiciona, renomeia, reordena ou remove as dele. O padrão nunca muda.
 */

export interface PosePadrao {
  id: string;
  nome: string;
  ordem: number;
}

export const POSES_PADRAO: readonly PosePadrao[] = [
  { id: '00000000-0000-4000-b000-000000000001', nome: 'Frente', ordem: 1 },
  { id: '00000000-0000-4000-b000-000000000002', nome: 'Perfil', ordem: 2 },
  { id: '00000000-0000-4000-b000-000000000003', nome: 'Costas', ordem: 3 },
];
