import { useRef, useState, type FormEvent } from 'react';
import type { DemoSession, DocumentKind, PendingSuggestion, Product, UploadResult } from '../api/types';
import { formatCnpj, formatConfidence, formatMoney, formatQuantity } from '../format';

interface SessionPanelProps {
  session: DemoSession | null | undefined;
  busy: boolean;
  restarting: boolean;
  onPrepare(): void;
  onRestart(sessionId: string): void;
  onDownload(kind: DocumentKind): void;
}

export function SessionPanel({ session, busy, restarting, onPrepare, onRestart, onDownload }: SessionPanelProps) {
  const [confirming, setConfirming] = useState(false);

  if (session === undefined) {
    return (
      <section aria-labelledby="session-heading" className="card">
        <h2 id="session-heading"><span aria-hidden="true">1. </span>Ambiente de exemplo</h2>
        <p role="status">Carregando o seu ambiente…</p>
      </section>
    );
  }

  if (session === null) {
    return (
      <section aria-labelledby="session-heading" className="card">
        <h2 id="session-heading"><span aria-hidden="true">1. </span>Ambiente de exemplo</h2>
        <p>
          Prepare uma empresa e um estoque sintéticos, vazios, só para você. Preparar o ambiente não
          usa IA e não cria produtos.
        </p>
        <button type="button" className="primary" onClick={onPrepare} disabled={busy}>
          {busy ? 'Preparando…' : 'Preparar ambiente'}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="session-heading" className="card">
      <h2 id="session-heading"><span aria-hidden="true">1. </span>Ambiente de exemplo</h2>
      <p>
        Empresa e estoque sintéticos prontos. Baixe as duas notas de exemplo (sem valor fiscal) e envie-as
        em ordem: primeiro a inicial, depois a complementar.
      </p>
      <div className="actions">
        <button type="button" onClick={() => onDownload('initial')}>Baixar nota inicial (1 produto)</button>
        <button type="button" onClick={() => onDownload('followup')}>Baixar nota complementar (3 linhas)</button>
      </div>
      <details>
        <summary>O que esperar</summary>
        <ul>
          <li>{session.expectedResults.initial.summary}</li>
          <li>{session.expectedResults.followup.summary}</li>
        </ul>
      </details>
      {confirming ? (
        <div className="confirm-box">
          <p>
            Reiniciar arquiva o ambiente atual e cria um novo, vazio, com notas novas. O estoque que você vê
            agora deixa de aparecer aqui.
          </p>
          <div className="actions">
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => { setConfirming(false); onRestart(session.id); }}
            >
              {restarting ? 'Reiniciando…' : 'Confirmar reinício'}
            </button>
            <button type="button" onClick={() => setConfirming(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button" onClick={() => setConfirming(true)} disabled={busy}>
          Reiniciar ambiente
        </button>
      )}
    </section>
  );
}

interface UploadPanelProps {
  disabled: boolean;
  uploading: boolean;
  lastUpload: UploadResult | null;
  onUpload(file: File): Promise<boolean>;
}

export function UploadPanel({ disabled, uploading, lastUpload, onUpload }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || disabled || uploading) return;
    // O arquivo só é descartado após sucesso: em falha o envio pode ser repetido manualmente.
    if (await onUpload(file)) {
      setFile(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section aria-labelledby="upload-heading" className="card">
      <h2 id="upload-heading"><span aria-hidden="true">2. </span>Enviar nota</h2>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="invoice-file">Arquivo da nota</label>
        <input
          id="invoice-file"
          ref={input}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          disabled={disabled}
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="hint">PDF, PNG ou JPEG de até 10 MiB. Uma nota por vez.</p>
        <button type="submit" className="primary" disabled={disabled || uploading || !file}>
          {uploading ? 'Processando…' : 'Enviar nota'}
        </button>
      </form>
      {uploading && (
        <div className="progress">
          <p role="status">Processando a nota…</p>
          <p className="hint">Isso pode levar alguns segundos. Não envie novamente enquanto aguarda.</p>
        </div>
      )}
      {lastUpload && !uploading && (
        <div className="result">
          <h3>Resultado da última nota</h3>
          <p>
            <strong>Aplicados ao estoque:</strong>{' '}
            {lastUpload.processedProducts.length === 0
              ? 'nenhum item.'
              : lastUpload.processedProducts.map((item) => item.code).join(', ')}
          </p>
          <p>
            <strong>Aguardando decisão:</strong>{' '}
            {lastUpload.suggestions.length === 0
              ? 'nenhum item.'
              : `${lastUpload.suggestions.map((item) => item.invoiceItem.code).join(', ')} — não contam no estoque até você decidir.`}
          </p>
        </div>
      )}
    </section>
  );
}

interface ReviewPanelProps {
  suggestions: PendingSuggestion[];
  products: Product[];
  busy: boolean;
  decidingId: string | null;
  onDecide(suggestionId: string, decision: 'confirm' | 'reject'): void;
}

export function ReviewPanel({ suggestions, products, busy, decidingId, onDecide }: ReviewPanelProps) {
  return (
    <section aria-labelledby="review-heading" className="card">
      <h2 id="review-heading"><span aria-hidden="true">3. </span>Revisar sugestões</h2>
      {suggestions.length === 0 ? (
        <p>Nenhuma sugestão pendente.</p>
      ) : (
        <ul className="suggestions">
          {suggestions.map((suggestion) => {
            const target = products.find((product) => product.id === suggestion.suggestedProductId);
            const heading = `suggestion-${suggestion.id}`;
            return (
              <li key={suggestion.id} aria-labelledby={heading} className="suggestion">
                <h3 id={heading}>Item {suggestion.receivedCode} parece o mesmo produto de {target?.code ?? 'outro código'}?</h3>
                <div className="compare">
                  <div>
                    <h4>Recebido na nota</h4>
                    <dl>
                      <dt>Código</dt><dd>{suggestion.receivedCode}</dd>
                      <dt>Descrição</dt><dd>{suggestion.receivedDescription}</dd>
                      <dt>Quantidade</dt><dd>{formatQuantity(suggestion.receivedQuantity)} {suggestion.unitMeasurement}</dd>
                      <dt>Preço unitário</dt><dd>{formatMoney(suggestion.receivedUnitPrice)}</dd>
                      <dt>Fornecedor</dt><dd>{formatCnpj(suggestion.receivedSupplierCnpj)}</dd>
                    </dl>
                  </div>
                  <div>
                    <h4>Produto sugerido no estoque</h4>
                    {target ? (
                      <dl>
                        <dt>Código</dt><dd>{target.code}</dd>
                        <dt>Descrição</dt><dd>{target.description}</dd>
                        <dt>Quantidade atual</dt><dd>{formatQuantity(target.quantity)} {target.unitMeasurement}</dd>
                        <dt>Preço médio</dt><dd>{formatMoney(target.unitPrice)}</dd>
                        <dt>Origem</dt><dd>{formatCnpj(target.sourceSupplierCnpj)}</dd>
                      </dl>
                    ) : (
                      <p>Produto sugerido não está na página carregada do estoque.</p>
                    )}
                  </div>
                </div>
                <p>
                  <strong>Motivo informado pelo modelo:</strong> {suggestion.reason}{' '}
                  <span className="hint">
                    (confiança do modelo: {formatConfidence(suggestion.confidence)} — indicação, não garantia)
                  </span>
                </p>
                <div className="actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => onDecide(suggestion.id, 'confirm')}
                  >
                    {decidingId === suggestion.id ? 'Aplicando…' : 'Confirmar sugestão: somar ao produto sugerido'}
                  </button>
                  <button type="button" disabled={busy} onClick={() => onDecide(suggestion.id, 'reject')}>
                    Rejeitar sugestão: cadastrar como produto novo
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface StockPanelProps {
  products: Product[];
  hasMore: boolean;
  loaded: boolean;
  refreshing: boolean;
  onLoadMore(): void;
  onRefresh(): void;
}

export function StockPanel({ products, hasMore, loaded, refreshing, onLoadMore, onRefresh }: StockPanelProps) {
  return (
    <section aria-labelledby="stock-heading" className="card">
      <div className="heading-row">
        <h2 id="stock-heading"><span aria-hidden="true">4. </span>Estoque</h2>
        <button type="button" className="link-button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>
      {!loaded ? (
        <p role="status">Carregando estoque…</p>
      ) : products.length === 0 ? (
        <p>Estoque vazio.</p>
      ) : (
        <ul className="stock">
          {products.map((product) => (
            <li key={product.id}>
              <span className="code">{product.code}</span>
              <span className="description">{product.description}</span>
              <span className="quantity" data-testid={`quantity-${product.code}`}>
                {formatQuantity(product.quantity)}
              </span>
              <span className="unit">{product.unitMeasurement}</span>
              <span className="price">{formatMoney(product.unitPrice)} / un.</span>
              <span className="origin">Origem: {formatCnpj(product.sourceSupplierCnpj)}</span>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button type="button" onClick={onLoadMore}>Carregar mais produtos</button>
      )}
    </section>
  );
}
