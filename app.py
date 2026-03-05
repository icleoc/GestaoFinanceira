import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
from datetime import datetime

# 1. Configuração do App
st.set_page_config(page_title="Jarvis Finance", layout="wide")

# 2. Conexão Supabase
conn = st.connection("supabase", type=SupabaseConnection)

def get_db(table):
    return conn.client.table(table).select("*").execute().data

# 3. Carregamento de Dados
try:
    contas = get_db("contas")
    categorias = get_db("categorias")
    
    # Cálculos das Métricas Superiores
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    divida_cards = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = saldo_bancos + divida_cards + invest_total

    # --- TÍTULO PRINCIPAL ---
    st.title("SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")

    # --- QUADROS DE RESUMO (KPIs) ---
    kpi1, kpi2, kpi3, kpi4 = st.columns(4)
    kpi1.metric("PATRIMÔNIO LÍQUIDO", f"R$ {patrimonio:,.2f}")
    kpi2.metric("SALDO TOTAL EM BANCOS", f"R$ {saldo_bancos:,.2f}")
    kpi3.metric("DÍVIDA TOTAL CARTÕES", f"R$ {abs(divida_cards):,.2f}")
    kpi4.metric("INVESTIMENTOS TOTAL", f"R$ {invest_total:,.2f}")

    st.divider()

    # --- DIVISÃO EM DUAS COLUNAS (LADO A LADO) ---
    col_left, col_right = st.columns([1.2, 1], gap="large")

    # --- COLUNA ESQUERDA: LISTAGEM DE CONTAS E CARTÕES ---
    with col_left:
        st.subheader("VISÃO GERAL DE CONTAS E CARTÕES")
        
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                c_b1, c_b2 = st.columns([4, 1])
                c_b1.write(f"› {b['nome']}")
                c_b2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        st.write("")
        
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                limite = c['limite_total']
                percent = (usado / limite) if limite > 0 else 0
                
                # Nome e Vencimento na mesma linha
                c_n, c_v = st.columns([4, 1])
                c_n.markdown(f"**{c['nome']}**")
                c_v.write(f"Venc: {c['dia_vencimento']:02d}")
                
                # Barra de preenchimento
                st.progress(min(percent, 1.0))
                st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")
                st.write("")

    # --- COLUNA DIREITA: GRÁFICO E REGISTROS ---
    with col_right:
        st.subheader("🧐 ONDE ESTÁ O VAZAMENTO?")
        
        # Gráfico Simples de Gastos
        trans_data = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data
        if trans_data:
            df = pd.DataFrame(trans_data)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'])
                st.bar_chart(df_g.groupby('Categoria')['valor'].sum().abs())
        
        st.divider()
        
        st.subheader("⚡ NOVO LANÇAMENTO / PAGAMENTO")
        tab_gasto, tab_pagamento = st.tabs(["💸 Gasto/Receita", "💳 Pagar Fatura"])
        
        with tab_gasto:
            with st.form("form_gasto", clear_on_submit=True):
                desc = st.text_input("Descrição")
                val = st.number_input("Valor R$", min_value=0.0)
                tipo = st.radio("Tipo", ["Despesa", "Receita"], horizontal=True)
                conta_origem = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
                cat_nome = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == ("Despesa" if tipo == "Despesa" else "Receita")])
                
                if st.form_submit_button("REGISTRAR", use_container_width=True):
                    cid = next(i['id'] for i in contas if i['nome'] == conta_origem)
                    catid = next(i['id'] for i in categorias if i['nome'] == cat_nome)
                    val_final = -val if tipo == "Despesa" else val
                    conn.client.table("transacoes").insert({"descricao": desc, "valor": val_final, "conta_origem_id": cid, "categoria_id": catid}).execute()
                    st.rerun()

        with tab_pagamento:
            with st.form("form_fatura", clear_on_submit=True):
                st.caption("Use para transferir saldo de banco para o cartão ou entre cartões.")
                banco_sai = st.selectbox("Sair dinheiro de:", [c['nome'] for c in contas])
                cartao_entra = st.selectbox("Pagar / Enviar para:", [c['nome'] for c in contas])
                val_pago = st.number_input("Valor do Pagamento", min_value=0.0)
                
                if st.form_submit_button("CONFIRMAR PAGAMENTO", use_container_width=True):
                    id_s = next(i['id'] for i in contas if i['nome'] == banco_sai)
                    id_e = next(i['id'] for i in contas if i['nome'] == cartao_entra)
                    # Tira de um
                    conn.client.table("transacoes").insert({"descricao": f"Pagto para {cartao_entra}", "valor": -val_pago, "conta_origem_id": id_s}).execute()
                    # Entra no outro
                    conn.client.table("transacoes").insert({"descricao": f"Recebido de {banco_sai}", "valor": val_pago, "conta_origem_id": id_e}).execute()
                    st.rerun()

except Exception as e:
    st.error(f"Erro: {e}")
