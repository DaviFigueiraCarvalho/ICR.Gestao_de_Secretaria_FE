import { useCallback, useEffect, useRef, type InputHTMLAttributes } from 'react';
import SmartSelect from './SmartSelect';
import { useViaCEP } from '../hooks/useViaCEP';
import { countrySelectItems, DEFAULT_COUNTRY_CODE, formatPostalCode, normalizePostalCode } from '../lib/country';

export type AddressFormValue = {
  countryCode?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  city?: string;
  state?: string;
  countyOrRegion?: string;
};

interface AddressFormFieldsProps {
  value: AddressFormValue;
  onChange: (nextValue: AddressFormValue) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function AddressFormFields({ value, onChange, disabled = false, required = false }: AddressFormFieldsProps) {
  const { fetchCEP, loading: cepLoading, error: cepError } = useViaCEP();
  const statesRef = useRef<Array<{ id: string; name: string }>>([]);
  const latestValueRef = useRef(value);
  const countryCode = value.countryCode || DEFAULT_COUNTRY_CODE;

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const setField = (field: keyof AddressFormValue, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const fetchStates = useCallback(async (page: number, query: string) => {
    if (!statesRef.current.length) {
      const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
      if (!response.ok) throw new Error('Não foi possível carregar os estados.');
      const data = await response.json() as Array<{ sigla: string; nome: string }>;
      statesRef.current = data.map((state) => ({ id: state.sigla, name: `${state.nome} (${state.sigla})` }));
    }

    const normalizedQuery = query.trim().toLowerCase();
    return statesRef.current
      .filter((state) => !normalizedQuery || state.name.toLowerCase().includes(normalizedQuery))
      .slice((page - 1) * 10, page * 10);
  }, []);

  const fetchCities = useCallback(async (page: number, query: string) => {
    if (!value.state) return [];
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${value.state}/municipios`);
    if (!response.ok) throw new Error('Não foi possível carregar os municípios.');
    const data = await response.json() as Array<{ nome: string }>;
    const normalizedQuery = query.trim().toLowerCase();
    return data
      .filter((city) => !normalizedQuery || city.nome.toLowerCase().includes(normalizedQuery))
      .slice((page - 1) * 10, page * 10)
      .map((city) => ({ id: city.nome, name: city.nome }));
  }, [value.state]);

  const handlePostalCodeChange = async (rawValue: string) => {
    const postalCode = normalizePostalCode(countryCode, rawValue);
    const nextValue = { ...value, postalCode };
    onChange(nextValue);

    if (countryCode !== 'BR' || postalCode.length !== 8) return;
    const cepData = await fetchCEP(postalCode);
    if (!cepData) return;
    const latestValue = latestValueRef.current;
    if ((latestValue.countryCode || DEFAULT_COUNTRY_CODE) !== countryCode || latestValue.postalCode !== postalCode) return;
    onChange({ ...latestValue, street: cepData.street, city: cepData.city, state: cepData.state });
  };

  const input = (label: string, field: keyof AddressFormValue, className = '', props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`text-white/70 text-sm font-['Nunito'] ${className}`}>
      {label}
      <input
        {...props}
        disabled={disabled || props.disabled}
        value={value[field] || ''}
        onChange={(event) => setField(field, event.target.value)}
        className="mt-1 w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
      />
    </label>
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      <SmartSelect
        className="col-span-2"
        label="País"
        selectedId={countryCode}
        selectedItem={countrySelectItems.find((country) => country.id === countryCode) || null}
        onSelect={(id) => onChange({ ...value, countryCode: String(id), postalCode: '', state: '', city: '' })}
        fetchItems={async (page, query) => countrySelectItems.filter((country) => country.name.toLowerCase().includes(query.toLowerCase())).slice((page - 1) * 10, page * 10)}
        placeholder="Selecione um país"
        disabled={disabled}
        required={required}
      />
      <label className="text-white/70 text-sm font-['Nunito']">
        {countryCode === 'BR' ? 'CEP' : 'Código postal'} {countryCode === 'BR' && cepLoading && <span className="text-[#017158] text-xs">buscando...</span>}
        <input
          disabled={disabled || cepLoading}
          value={formatPostalCode(countryCode, value.postalCode || '')}
          onChange={(event) => void handlePostalCodeChange(event.target.value)}
          inputMode={countryCode === 'BR' ? 'numeric' : 'text'}
          maxLength={countryCode === 'BR' ? 9 : 24}
          placeholder={countryCode === 'BR' ? '00000-000' : 'Informe o código postal'}
          className="mt-1 w-full bg-[#1c1c1c] border border-white/20 rounded-lg px-4 py-2.5 text-white font-['Nunito'] text-sm focus:outline-none focus:border-[#017158] disabled:opacity-50"
        />
        {countryCode === 'BR' && cepError && <p className="mt-1 text-xs text-red-400">{cepError}</p>}
      </label>
      {input('Número', 'number', '', { placeholder: 'Nº' })}
      {input('Rua', 'street', 'col-span-2', { placeholder: 'Nome da rua' })}
      {input('Complemento', 'complement', 'col-span-2', { placeholder: 'Apto., bloco, referência' })}
      {countryCode === 'BR' ? <>
        <SmartSelect label="Estado" selectedId={value.state || ''} selectedItem={value.state ? { id: value.state, name: value.state } : null} onSelect={(id) => onChange({ ...value, state: String(id), city: '' })} fetchItems={fetchStates} placeholder="Selecione o estado" disabled={disabled} required={required} />
        <SmartSelect label="Município" selectedId={value.city || ''} selectedItem={value.city ? { id: value.city, name: value.city } : null} onSelect={(id) => setField('city', String(id))} fetchItems={fetchCities} placeholder="Selecione o município" disabled={disabled || !value.state} required={required} />
      </> : <>
        {input('Estado', 'state', '', { placeholder: 'Estado/Região' })}
        {input('Cidade', 'city', '', { placeholder: 'Cidade' })}
      </>}
      {input('Região/Condado', 'countyOrRegion', '', { placeholder: 'Bairro, condado ou região' })}
    </div>
  );
}
