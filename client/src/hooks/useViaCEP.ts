/**
 * Hook para buscar endereço via CEP usando ViaCEP
 * API: https://viacep.com.br/
 */

import { useState } from 'react';

export interface CEPData {
  zipCode: string;
  street: string;
  number: string;
  city: string;
  state: string;
}

interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export function useViaCEP() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCEP = async (zipCode: string): Promise<CEPData | null> => {
    if (!zipCode) {
      setError(null);
      return null;
    }

    // Remove caracteres não numéricos
    const cleanCEP = zipCode.replace(/\D/g, '');

    // Valida se tem 8 dígitos
    if (cleanCEP.length !== 8) {
      setError('CEP deve conter exatamente 8 números');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      
      if (!response.ok) {
        throw new Error('Erro ao buscar CEP');
      }

      const data: ViaCEPResponse = await response.json();

      // ViaCEP retorna erro: true quando não encontra o CEP
      if (data.erro) {
        setError('CEP não encontrado');
        return null;
      }

      const result: CEPData = {
        zipCode: data.cep,
        street: data.logradouro,
        number: '', // ViaCEP não retorna número
        city: data.localidade,
        state: data.uf,
      };

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao buscar CEP';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchCEP, loading, error };
}
