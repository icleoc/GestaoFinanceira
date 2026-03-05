import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd

# 1. Configuração da Página
st.set_page_config(page_title="Jarvis Finance - Léo", layout="wide", page_icon="💰")

# 2. CSS para Visual Premium Dark (Igual à prévia)
st.markdown("""
    <style>
    [data-testid="stMetricValue"] { font-size: 28px !important; color: #00d4ff !important; }
    [data-testid="stMetricLabel"] { font-size: 14px !important; color: #ffffff !important; }
    .stProgress > div > div > div > div { background-image: linear-gradient(to right, #28a745, #ffc107, #dc3545); }
    .card-meta {
        background-color: #1e2130;
        padding: 20px;
        border-radius: 10px;
        border-top: 4px solid #00d4ff;
        text-align: center;
    }
    .main { background-color: #0e1117; }
    </style>
    """, unsafe_allow_html=True)

# 3. Conexão
conn = st.connection("supabase", type=SupabaseConnection)

# --- FUNÇÕES DE BUSCA ---
def get_data(table):
    return conn.client.table(table).select("*").execute().data

def get_full_trans():
    return conn.client.table("transacoes").select("data, descricao, valor, contas(nome), categorias(nome)").order("criado_em", desc=True).limit(10).execute().data

# --- CARREGAMENTO ---
try:
    contas = get_data("contas")
    cats = get_data("categorias")
    trans_recentes = get_full_trans()

    # Cálculos para o Topo
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    invest_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    divida_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    patrimonio = saldo_bancos + invest_total + divida_total

    # --- HEADER IGUAL À PRÉVIA ---
    st.title("💰 SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    m1, m2, m3, m4 = st.columns(4)
    with m1: st.metric("PATRIMÔNIO LÍQUIDO", f"R$ {patrimonio:,.2f}")
    with m2: st.metric("SALDO TOTAL EM BANCOS", f"R$ {saldo_bancos:,.2f}")
    with m3: st.metric("DÍVIDA CARTÕES (Aberto)", f"R$ {abs(divida_total):,.2f}")
    with m4: st.metric("INVESTIMENTOS TOTAL", f"R$ {invest_total:,.2f}")

    st.markdown("---")

    # --- LAYOUT DE DUAS COLUNAS (VISÃO GERAL VS VAZAMENTO) ---
    col_esquerda, col_direita = st.columns([1.3, 1], gap="large")

    with col_esquerda:
        st.subheader("📊 VISÃO GERAL DE CONTAS E CARTÕES")
        
        # Bloco de Bancos
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                c_b1, c_b2 = st.columns([3, 1])
                c_b1.write(f"**{b['nome']}**")
                c_b2.write(f"R$ {b['saldo_atual']:,.2f}")

        # Bloco de Cartões com Barras de Progresso
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            st.markdown("**Name | Limite Usado vs. Disponível | Venc.**")
            for card in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(card['saldo_atual'])
                limite = card['limite_total']
                percent = (usado / limite) if limite > 0 else 0
                
                c_n, c_p, c_v = st.columns([1, 2.5, 0.5])
                c_n.write(f"**{card['nome']}**")
                c_p.progress(min(percent, 1.0))
                c_v.write(f"{card['dia_vencimento']:02d}")
                st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_direita:
        st.subheader("🧐 ONDE ESTÁ O VAZAMENTO?")
        
        # Gráfico de Gastos (Igual à prévia)
        if trans_recentes:
            df = pd.DataFrame(trans_recentes)
            df_gastos = df[df['valor'] < 0].copy()
            if not df_gastos.empty:
                df_gastos['abs_valor'] = df_gastos['valor'].abs()
                df_gastos['Cat'] = df_gastos['categorias'].apply(lambda x: x['nome'])
                st.write("**Gastos por Categoria (Este Mês)**")
                st.bar_chart(df_gastos.groupby('Cat')['abs_valor'].sum())

        # Botão de Novo Lançamento (Ação rápida)
        with st.expander("➕ NOVO LANÇAMENTO", expanded=False):
            with st.form("add_new"):
                d = st.text_input("Descrição")
                v = st.number_input("Valor", min_value=0.01)
                tp = st.radio("Tipo", ["Despesa", "Receita"], horizontal=True)
                co = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
                ca = st.selectbox("Categoria", [cat['nome'] for cat in cats if cat['tipo'] == tp])
                if st.form_submit_button("Lançar Agora", use_container_width=True):
                    cid = next(i['id'] for i in contas if i['nome'] == co)
                    caid = next(i['id'] for i in cats if i['nome'] == ca)
                    vfinal = -v if tp == "Despesa" else v
                    conn.client.table("transacoes").insert({"descricao":d,"valor":vfinal,"conta_origem_id":cid,"categoria_id":caid}).execute()
                    st.rerun()

        st.subheader("📑 ÚLTIMAS MOVIMENTAÇÕES")
        if trans_recentes:
            df_t = pd.DataFrame(trans_recentes)
            df_t['Conta'] = df_t['contas'].apply(lambda x: x['nome'])
            st.dataframe(df_t[['data', 'descricao', 'valor', 'Conta']], use_container_width=True)

except Exception as e:
    st.error(f"Erro no sistema: {e}")
