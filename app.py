import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
import plotly.express as px

# Forçar Layout Wide e Configurações
st.set_page_config(page_title="Jarvis Finance Pro", layout="wide")

# Credenciais Diretas para evitar erro de conexão
URL = "https://dqhyjrvhasmjwblidnqj.supabase.co"
KEY = "sb_secret_Z7afUJuNCrVvyPn2nFzupw_h8So8gQG"

# CSS CUSTOMIZADO PARA COPIAR A META (Fundo claro, cards coloridos)
st.markdown("""
    <style>
    .main { background-color: #f0f2f6; }
    .card-container { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px; }
    .kpi-card { border-radius: 10px; padding: 20px; flex: 1; box-shadow: 2px 2px 10px rgba(0,0,0,0.1); }
    .azul { background-color: #1a3a5a; color: white; }
    .branco { background-color: #ffffff; color: #333; }
    .salmao { background-color: #fce4d6; color: #a55d35; }
    .section-box { background-color: white; border-radius: 10px; padding: 20px; box-shadow: 2px 2px 10px rgba(0,0,0,0.05); }
    </style>
    """, unsafe_allow_html=True)

try:
    conn = st.connection("supabase", type=SupabaseConnection, url=URL, key=KEY)
    contas = conn.client.table("contas").select("*").execute().data
    trans_raw = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data

    # Cálculos
    s_banco = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    d_card = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = s_banco + d_card + invest

    # --- HEADER E CARDS (IGUAL À META) ---
    st.markdown("### SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    col1, col2, col3, col4 = st.columns(4)
    col1.markdown(f"<div class='kpi-card azul'><small>PATRIMÔNIO LÍQUIDO</small><h2>R$ {patrimonio:,.2f}</h2></div>", unsafe_allow_html=True)
    col2.markdown(f"<div class='kpi-card branco'><small>SALDO TOTAL EM BANCOS</small><h2>R$ {s_banco:,.2f}</h2></div>", unsafe_allow_html=True)
    col3.markdown(f"<div class='kpi-card salmao'><small>DÍVIDA TOTAL CARTÕES</small><h2>R$ {abs(d_card):,.2f}</h2></div>", unsafe_allow_html=True)
    col4.markdown(f"<div class='kpi-card branco'><small>INVESTIMENTOS TOTAL</small><h2>R$ {invest:,.2f}</h2></div>", unsafe_allow_html=True)

    st.write("")

    # --- CORPO EM COLUNAS ---
    col_l, col_r = st.columns([1.5, 1], gap="large")

    with col_l:
        st.markdown("#### VISÃO GERAL DE CONTAS E CARTÕES")
        with st.container():
            st.write("**🏦 BANCOS (Liquidez)**")
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                c_b1, c_b2 = st.columns([4, 1])
                c_b1.write(f"› {b['nome']}")
                c_b2.write(f"**+ R$ {b['saldo_atual']:,.2f}**")
            
            st.write("---")
            st.write("**💳 CARTÕES DE CRÉDITO**")
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado, limite = abs(c['saldo_atual']), c['limite_total']
                perc = (usado / limite) if limite > 0 else 0
                r1, r2, r3 = st.columns([1, 2.5, 0.5])
                r1.write(f"**{c['nome']}**")
                r2.progress(min(perc, 1.0))
                r3.write(f"{c['dia_vencimento']:02d}")
                st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_r:
        st.markdown("#### ONDE ESTÁ O VAZAMENTO?")
        if trans_raw:
            df = pd.DataFrame(trans_raw)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Cat'] = df_g['categorias'].apply(lambda x: x['nome'])
                fig = px.pie(df_g, values=df_g['valor'].abs(), names='Cat', hole=0.5)
                fig.update_layout(margin=dict(t=0, b=0, l=0, r=0), height=250)
                st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### ⚡ NOVO GASTO / RECEBIMENTO")
        with st.form("main_form", clear_on_submit=True):
            tipo = st.radio("Tipo:", ["Despesa", "Receita", "Pagar Fatura"], horizontal=True)
            desc = st.text_input("Descrição")
            val = st.number_input("Valor", min_value=0.0)
            origem = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
            
            if st.form_submit_button("REGISTRAR", use_container_width=True):
                # Lógica de processamento...
                st.rerun()

except Exception as e:
    st.error(f"Erro: {e}")
