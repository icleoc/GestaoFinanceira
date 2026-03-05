import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
from datetime import datetime

# 1. Configuração do App (Layout de Tablet como no print)
st.set_page_config(page_title="Jarvis Finance", layout="wide")

# 2. Conexão Supabase
conn = st.connection("supabase", type=SupabaseConnection)

def get_data(table):
    return conn.client.table(table).select("*").execute().data

# --- CSS PARA FORÇAR O VISUAL DO PRINT ---
st.markdown("""
    <style>
    .kpi-card { background-color: #1e2130; padding: 15px; border-radius: 5px; border-top: 4px solid #00d4ff; }
    .stProgress > div > div > div > div { background-color: #00d4ff !important; }
    .vencimento-alerta { color: #ff4b4b; font-weight: bold; }
    </style>
    """, unsafe_allow_html=True)

try:
    # Carregamento
    contas = get_data("contas")
    categorias = get_data("categorias")
    
    # 3. HEADER (Fiel ao print)
    st.markdown("### 🏦 SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    # Métricas Superiores
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    divida_cards = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = saldo_bancos + divida_cards + invest_total

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("PATRIMÔNIO LÍQUIDO", f"R$ {patrimonio:,.2f}")
    m2.metric("SALDO TOTAL EM BANCOS", f"R$ {saldo_bancos:,.2f}")
    m3.metric("DÍVIDA TOTAL CARTÕES", f"R$ {abs(divida_cards):,.2f}")
    m4.metric("INVESTIMENTOS TOTAL", f"R$ {invest_total:,.2f}")

    st.divider()

    # 4. COLUNA DA ESQUERDA (VISÃO GERAL)
    col_left, col_right = st.columns([1.2, 1], gap="large")

    with col_left:
        st.markdown("#### VISÃO GERAL DE CONTAS E CARTÕES")
        
        # BANCOS (Liquidez)
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                cl1, cl2 = st.columns([4, 1])
                cl1.write(f"› {b['nome']}")
                cl2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        st.write("")
        
        # CARTÕES DE CRÉDITO (Exatamente como o print)
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            st.markdown("**Name | Limite Usado vs. Disponível | Venc.**")
            dia_hoje = datetime.now().day
            
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                limite = c['limite_total']
                percent = (usado / limite) if limite > 0 else 0
                venc = c['dia_vencimento']
                
                row1, row2, row3 = st.columns([1, 2.5, 0.5])
                row1.write(f"**{c['nome']}**")
                row2.progress(min(percent, 1.0))
                
                # Alerta de Vencimento
                venc_style = "vencimento-alerta" if 0 <= (venc - dia_hoje) <= 5 else ""
                row3.markdown(f"<span class='{venc_style}'>Dia {venc:02d}</span>", unsafe_allow_html=True)
                st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")
                st.write("")

    # 5. COLUNA DA DIREITA (VAZAMENTO E LANÇAMENTO)
    with col_right:
        st.markdown("#### 🧐 ONDE ESTÁ O VAZAMENTO?")
        
        # Gráfico (Vazamento por Categoria)
        trans_data = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data
        if trans_data:
            df = pd.DataFrame(trans_data)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'])
                st.bar_chart(df_g.groupby('Categoria')['valor'].sum().abs())
        
        st.write("")
        st.markdown("#### ⚡ AÇÕES RÁPIDAS")
        tab1, tab2 = st.tabs(["Lançamento", "Pagar Fatura"])
        
        with tab1:
            with st.form("form_lançar", clear_on_submit=True):
                tipo = st.radio("Operação:", ["Despesa", "Receita"], horizontal=True)
                desc = st.text_input("Descrição (Ex: Gasolina)")
                val = st.number_input("Valor R$", min_value=0.01)
                conta = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
                cat = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == tipo])
                
                if st.form_submit_button("REGISTRAR", use_container_width=True):
                    c_id = next(i['id'] for i in contas if i['nome'] == conta)
                    cat_id = next(i['id'] for i in categorias if i['nome'] == cat)
                    v_final = -val if tipo == "Despesa" else val
                    conn.client.table("transacoes").insert({"descricao": desc, "valor": v_final, "conta_origem_id": c_id, "categoria_id": cat_id}).execute()
                    st.rerun()

        with tab2:
            with st.form("form_fatura", clear_on_submit=True):
                st.caption("Pagar fatura de cartão com saldo de banco")
                sai = st.selectbox("Sair de (Banco):", [c['nome'] for c in contas if c['tipo'] == 'Corrente'])
                entra = st.selectbox("Pagar (Cartão):", [c['nome'] for c in contas if c['tipo'] == 'Crédito'])
                valor_pago = st.number_input("Valor do Pagamento", min_value=0.01)
                
                if st.form_submit_button("CONFIRMAR PAGAMENTO", use_container_width=True):
                    id_s = next(i['id'] for i in contas if i['nome'] == sai)
                    id_e = next(i['id'] for i in contas if i['nome'] == entra)
                    # 1. Sai do Banco
                    conn.client.table("transacoes").insert({"descricao": f"Pagto Fatura {entra}", "valor": -valor_pago, "conta_origem_id": id_s}).execute()
                    # 2. Entra no Cartão
                    conn.client.table("transacoes").insert({"descricao": "Recebimento Pagto", "valor": valor_pago, "conta_origem_id": id_e}).execute()
                    st.rerun()

except Exception as e:
    st.error(f"Erro no Jarvis: {e}")
