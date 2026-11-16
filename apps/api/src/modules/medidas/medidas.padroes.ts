/**
 * BE-MED-02 · Tipos de medida padrão do sistema.
 *
 * Mesma ideia das poses padrão (fotos.padroes.ts): servem de BASE. Cada
 * profissional recebe uma cópia deles na primeira vez que usa as medidas e, a
 * partir daí, adiciona, edita ou desativa os dele. O padrão nunca muda.
 *
 * No banco ficam em tipos_medida com profissional_id NULL (seed DB-021),
 * com estes mesmos ids.
 */

import type { Unidade } from './medidas.schemas';

export interface TipoMedidaPadrao {
  id: string;
  nome: string;
  unidade: Unidade;
}

export const TIPOS_MEDIDA_PADRAO: readonly TipoMedidaPadrao[] = [
  { id: '00000000-0000-4000-c000-000000000001', nome: 'Tórax', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000002', nome: 'Cintura', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000003', nome: 'Abdômen', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000004', nome: 'Quadril', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000005', nome: 'Braço direito', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000006', nome: 'Braço esquerdo', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000007', nome: 'Coxa direita', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000008', nome: 'Coxa esquerda', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000009', nome: 'Panturrilha direita', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000010', nome: 'Panturrilha esquerda', unidade: 'cm' },
  { id: '00000000-0000-4000-c000-000000000011', nome: 'Gordura corporal', unidade: '%' },
];
