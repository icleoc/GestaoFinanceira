import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
from datetime import datetime

# 1. Configuração da Página
st.set_page_config(page_title="Jarvis Finance Pro", layout="wide", page_icon="💳")

# 2. CSS Customizado para Visual Moderno (Fundo Escuro, Cards Profissionais)
st.markdown("""
    <style>
    .stApp { background-color: #0e1117; }
    [data-testid="stMetric"] {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 10px;
        padding: 15px !important;
    }
    .status-vencido { color: #ff4b4b; font-weight: bold; }
    .status-ok { color: #00d4ff; }
    .stProgress > div > div > div > div { background-color: #00d4ff; }
    
    /* Ajuste para inputs e botões ficarem modernos */
    .stButton>button {
        width: 100%;
        background-color: #00d4ff;
        color: black;
        border-radius: 5px;
        font-weight: bold;
    }
    </style>
    """, unsafe_allow_html=True)

# 3. Conexão Supabase
conn = st.connection("supabase", type=SupabaseConnection)

# --- FUNÇÕES DE DADOS ---
def get_db(table):
    return conn.client.table(table).select("*").execute().data

def get_trans_full():
    return conn.client.table("transacoes").select("data, descricao, valor, contas(nome), categorias(nome)").order("criado_em", desc=True).limit(10).execute().data

# --- CARREGAMENTO INICIAL ---
try:
    contas = get_db("contas")
    categorias = get_db("categorias")
    recentes = get_trans_full()

    # Cálculos das Métricas
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    divida_cartoes = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    investimentos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = saldo_bancos + divida_cartoes + investimentos

    # --- TÍTULO E MÉTRICAS ---
    st.markdown("# 💎 SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("PATRIMÔNIO LÍQUIDO", f"R$ {patrimonio:,.2f}")
    m2.metric("SALDO EM BANCOS", f"R$ {saldo_bancos:,.2f}")
    m3.metric("DÍVIDA CARTÕES", f"R$ {abs(divida_cartoes):,.2f}")
    m4.metric("INVESTIMENTOS", f"R$ {investimentos:,.2f}")

    st.divider()

    # --- LAYOUT PRINCIPAL (COLUNAS DA IMAGEM) ---
    col_listas, col_acoes = st.columns([1.5, 1], gap="large")

    with col_listas:
        # SEÇÃO BANCOS
        st.subheader("🏦 BANCOS (Liquidez)")
        for b in [c for c in contas if c['tipo'] == 'Corrente']:
            col_b1, col_b2 = st.columns([4, 1])
            col_b1.write(f"🔹 {b['nome']}")
            col_b2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        st.write("")
        
        # SEÇÃO CARTÕES COM BARRAS E ALERTAS
        st.subheader("💳 CARTÕES DE CRÉDITO")
        dia_atual = datetime.now().day
        
        for c in [c for c in contas if c['tipo'] == 'Crédito']:
            usado = abs(c['saldo_atual'])
            limite = c['limite_total']
            percent = (usado / limite) if limite > 0 else 0
            venc = c['dia_vencimento']
            
            # Alerta de vencimento (Próximos 5 dias)
            status_class = "status-vencido" if 0 <= (venc - dia_atual) <= 5 else "status-ok"
            
            col_n, col_p, col_v = st.columns([1.5, 2.5, 0.8])
            col_n.markdown(f"**{c['nome']}**")
            col_p.progress(min(percent, 1.0))
            col_v.markdown(f"<span class='{status_class}'>Dia {venc:02d}</span>", unsafe_allow_html=True)
            st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_acoes:
        # SEÇÃO ONDE ESTÁ O VAZAMENTO
        st.subheader("🧐 ONDE ESTÁ O VAZAMENTO?")
        if recentes:
            df = pd.DataFrame(recentes)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'])
                g_data = df_g.groupby('Categoria')['valor'].sum().abs()
                st.bar_chart(g_data)

        # SEÇÃO NOVO LANÇAMENTO / PAGAMENTO (Ações Rápidas)
        st.subheader("⚡ AÇÕES RÁPIDAS")
        acao = st.radio("Operação:", ["Novo Gasto", "Recebimento", "Pagar Fatura / Transf"], horizontal=True)

        with st.container():
            if acao in ["Novo Gasto", "Recebimento"]:
                with st.form("form_gasto", clear_on_submit=True):
                    desc = st.text_input("Descrição (Ex: Gasolina)")
                    valor = st.number_input("Valor R$", min_value=0.0)
                    conta_op = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
                    cat_op = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == ("Despesa" if acao == "Novo Gasto" else "Receita")])
                    
                    if st.form_submit_button("REGISTRAR"):
                        id_c = next(i['id'] for i in contas if i['nome'] == conta_op)
                        id_cat = next(i['id'] for i in categorias if i['nome'] == cat_op)
                        val_f = -valor if acao == "Novo Gasto" else valor
                        conn.client.table("transacoes").insert({"descricao": desc, "valor": val_f, "conta_origem_id": id_c, "categoria_id": id_cat}).execute()
                        st.rerun()

            else: # Lógica de Pagamento de Fatura / Transferência
                with st.form("form_transferencia", clear_on_submit=True):
                    st.caption("Ex: Pagar fatura com saldo do banco ou rolar dívida entre cartões.")
                    origem = st.selectbox("Sair dinheiro de / Usar Limite de:", [c['nome'] for c in contas])
                    destino = st.selectbox("Pagar Cartão / Enviar para:", [c['nome'] for c in contas])
                    valor_t = st.number_input("Valor da Operação", min_value=0.0)
                    
                    if st.form_submit_button("CONFIRMAR PAGAMENTO"):
                        id_ori = next(i['id'] for i in contas if i['nome'] == origem)
                        id_des = next(i['id'] for i in contas if i['nome'] == destino)
                        
                        # 1. Sai da Origem (Aumenta dívida se for cartão, diminui saldo se for banco)
                        conn.client.table("transacoes").insert({"descricao": f"Pagto para {destino}", "valor": -valor_t, "conta_origem_id": id_ori}).execute()
                        # 2. Entra no Destino (Diminui dívida do cartão ou aumenta saldo do banco)
                        conn.client.table("transacoes").insert({"descricao": f"Recebido de {origem}", "valor": valor_t, "conta_origem_id": id_des}).execute()
                        st.success("Operação Concluída!")
                        st.rerun()

except Exception as e:
    st.error(f"Erro na conexão: {e}")
