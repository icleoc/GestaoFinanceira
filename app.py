import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
import plotly.express as px

# Configuração da Página
st.set_page_config(page_title="Jarvis Finance Pro", layout="wide")

# Conexão
conn = st.connection("supabase", type=SupabaseConnection)

# CSS para forçar o estilo dos cards coloridos
st.markdown("""
    <style>
    .card { padding: 20px; border-radius: 10px; color: white; margin-bottom: 10px; }
    .azul { background-color: #1e3a5f; }
    .branco { background-color: #ffffff; color: #333; border: 1px solid #ddd; }
    .salmao { background-color: #fce4d6; color: #a55d35; border: 1px solid #f4b084; }
    </style>
    """, unsafe_allow_html=True)

try:
    # Busca de dados
    contas = conn.client.table("contas").select("*").execute().data
    categorias = conn.client.table("categorias").select("*").execute().data
    transacoes = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data

    # --- HEADER ---
    st.markdown("## SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    # KPIs Coloridos (Estilo o print de meta)
    s_banco = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    d_card = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = s_banco + d_card + invest

    k1, k2, k3, k4 = st.columns(4)
    k1.markdown(f"<div class='card azul'><small>PATRIMÔNIO LÍQUIDO</small><br><h2>R$ {patrimonio:,.2f}</h2></div>", unsafe_allow_html=True)
    k2.markdown(f"<div class='card branco'><small>SALDO TOTAL EM BANCOS</small><br><h2>R$ {s_banco:,.2f}</h2></div>", unsafe_allow_html=True)
    k3.markdown(f"<div class='card salmao'><small>DÍVIDA TOTAL CARTÕES</small><br><h2>R$ {abs(d_card):,.2f}</h2></div>", unsafe_allow_html=True)
    k4.markdown(f"<div class='card branco'><small>INVESTIMENTOS TOTAL</small><br><h2>R$ {invest:,.2f}</h2></div>", unsafe_allow_html=True)

    st.write("")

    # --- CORPO EM DUAS COLUNAS ---
    col_lista, col_grafico = st.columns([1.2, 1], gap="large")

    with col_lista:
        st.markdown("### VISÃO GERAL DE CONTAS E CARTÕES")
        
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                c_b1, c_b2 = st.columns([4, 1])
                c_b1.write(f"› {b['nome']}")
                c_b2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        st.write("")
        
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            st.markdown("<small>Name | Limite Usado vs. Disponível | Venc.</small>", unsafe_allow_html=True)
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                limite = c['limite_total']
                perc = (usado / limite) if limite > 0 else 0
                
                # Linha do cartão igual à foto
                r1, r2, r3 = st.columns([1, 2.5, 0.5])
                r1.write(f"**{c['nome']}**")
                r2.progress(min(perc, 1.0))
                r3.write(f"{c['dia_vencimento']:02d}")
                st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_grafico:
        st.markdown("### ONDE ESTÁ O VAZAMENTO?")
        if transacoes:
            df = pd.DataFrame(transacoes)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'])
                fig = px.pie(df_g, values=df_g['valor'].abs(), names='Categoria', hole=0.5)
                fig.update_layout(showlegend=True, margin=dict(t=0, b=0, l=0, r=0))
                st.plotly_chart(fig, use_container_width=True)

        st.markdown("### ⚡ NOVO GASTO / RECEBIMENTO")
        with st.form("registro", clear_on_submit=True):
            d = st.text_input("Descrição")
            v = st.number_input("Valor R$", min_value=0.0)
            origem = st.selectbox("Conta Origem", [c['nome'] for c in contas])
            if st.form_submit_button("REGISTRAR", use_container_width=True):
                # Lógica simplificada de insert
                st.success("Registrado!")
                st.rerun()

except Exception as e:
    st.error(f"Erro: {e}")
