import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
import plotly.express as px

# Configuração da Página
st.set_page_config(page_title="Jarvis Finance Pro", layout="wide")

# Credenciais que você me passou (Usadas como fallback se as secrets falharem)
SUPABASE_URL = "https://dqhyjrvhasmjwblidnqj.supabase.co"
SUPABASE_KEY = "sb_secret_Z7afUJuNCrVvyPn2nFzupw_h8So8gQG"

# CSS para forçar o layout idêntico à meta (Cards coloridos e tipografia limpa)
st.markdown("""
    <style>
    .kpi-container { display: flex; gap: 10px; margin-bottom: 25px; }
    .card { padding: 20px; border-radius: 8px; flex: 1; height: 130px; }
    .card-azul { background-color: #1a3a5a; color: white; border-top: 5px solid #00d4ff; }
    .card-branco { background-color: #ffffff; color: #333; border: 1px solid #ddd; }
    .card-salmao { background-color: #fce4d6; color: #a55d35; border: 1px solid #f4b084; }
    .stProgress > div > div > div > div { background-color: #00d4ff !important; }
    .main { background-color: #f8f9fa; }
    </style>
    """, unsafe_allow_html=True)

try:
    # Tentativa de conexão robusta
    conn = st.connection("supabase", type=SupabaseConnection, url=SUPABASE_URL, key=SUPABASE_KEY)
    
    # Busca de dados
    contas = conn.client.table("contas").select("*").execute().data
    categorias = conn.client.table("categorias").select("*").execute().data
    trans_raw = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data

    # Cálculos KPIs
    s_banco = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    d_card = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = s_banco + d_card + invest

    # --- HEADER E CARDS (IDÊNTICO AO PRINT DE META) ---
    st.markdown("### SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    c1, c2, c3, c4 = st.columns(4)
    c1.markdown(f"<div class='card card-azul'><small>PATRIMÔNIO LÍQUIDO</small><h2>R$ {patrimonio:,.2f}</h2></div>", unsafe_allow_html=True)
    c2.markdown(f"<div class='card card-branco'><small>SALDO TOTAL EM BANCOS</small><h2>R$ {s_banco:,.2f}</h2></div>", unsafe_allow_html=True)
    c3.markdown(f"<div class='card card-salmao'><small>DÍVIDA TOTAL CARTÕES</small><h2>R$ {abs(d_card):,.2f}</h2></div>", unsafe_allow_html=True)
    c4.markdown(f"<div class='card card-branco'><small>INVESTIMENTOS TOTAL</small><h2>R$ {invest:,.2f}</h2></div>", unsafe_allow_html=True)

    st.write("")

    # --- LAYOUT DE COLUNAS (1.5 : 1) ---
    col_l, col_r = st.columns([1.5, 1], gap="large")

    with col_l:
        st.markdown("#### VISÃO GERAL DE CONTAS E CARTÕES")
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                b_c1, b_c2 = st.columns([4, 1])
                b_c1.write(f"› {b['nome']}")
                b_c2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            st.markdown("<small>Name | Limite Usado vs. Disponível | Venc.</small>", unsafe_allow_html=True)
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado, limite = abs(c['saldo_atual']), c['limite_total']
                perc = (usado / limite) if limite > 0 else 0
                
                r1, r2, r3 = st.columns([1, 2.5, 0.5])
                r1.write(f"**{c['nome']}**")
                r2.progress(min(perc, 1.0))
                r3.write(f"{c['dia_vencimento']:02d}")
                st.caption(f"Gasto: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_r:
        st.markdown("#### ONDE ESTÁ O VAZAMENTO?")
        if trans_raw:
            df = pd.DataFrame(trans_raw)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'])
                # GRÁFICO DE PIZZA IGUAL À REFERÊNCIA
                fig = px.pie(df_g, values=df_g['valor'].abs(), names='Categoria', hole=0.5)
                fig.update_layout(margin=dict(t=0, b=0, l=0, r=0), height=300)
                st.plotly_chart(fig, use_container_width=True)
        
        st.divider()
        
        # FORMULÁRIO DE REGISTRO
        st.markdown("#### ⚡ AÇÕES RÁPIDAS")
        acao = st.radio("Operação:", ["Novo Gasto", "Receita", "Pagar Fatura"], horizontal=True)
        with st.form("main_form", clear_on_submit=True):
            if acao != "Pagar Fatura":
                desc = st.text_input("Descrição")
                val = st.number_input("Valor", min_value=0.0)
                ct = st.selectbox("Conta", [c['nome'] for c in contas])
                cat = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == ("Despesa" if acao == "Novo Gasto" else "Receita")])
            else:
                desc = "Pagamento de Fatura"
                val = st.number_input("Valor Pago", min_value=0.0)
                ct = st.selectbox("Sair de:", [c['nome'] for c in contas if c['tipo'] == 'Corrente'])
                destino = st.selectbox("Pagar:", [c['nome'] for c in contas if c['tipo'] == 'Crédito'])

            if st.form_submit_button("REGISTRAR", use_container_width=True):
                # Lógica Supabase (IDs e Inserts)
                st.rerun()

except Exception as e:
    st.error(f"Erro Crítico: {e}")
