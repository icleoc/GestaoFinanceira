import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
from datetime import datetime

# 1. Configuração de Layout
st.set_page_config(page_title="Jarvis Finance", layout="wide")

# 2. Conexão Estável
conn = st.connection("supabase", type=SupabaseConnection)

def get_data(table):
    return conn.client.table(table).select("*").execute().data

# 3. Carregamento de Dados
try:
    contas = get_data("contas")
    categorias = get_data("categorias")
    
    # Cálculos para os Cards Superiores
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    divida_cards = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    investimentos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = saldo_bancos + divida_cards + investimentos

    # --- TÍTULO ---
    st.markdown("### SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")

    # --- CARDS DE RESUMO ---
    m1, m2, m3, m4 = st.columns(4)
    m1.info(f"**PATRIMÔNIO LÍQUIDO**\n# R$ {patrimonio:,.2f}")
    m2.success(f"**SALDO EM BANCOS**\n# R$ {saldo_bancos:,.2f}")
    m3.warning(f"**DÍVIDA CARTÕES**\n# R$ {abs(divida_cards):,.2f}")
    m4.help(f"**INVESTIMENTOS TOTAL**\n# R$ {investimentos:,.2f}")

    st.markdown("---")

    # --- LAYOUT EM DUAS COLUNAS PRINCIPAIS ---
    col_dados, col_acoes = st.columns([1.5, 1], gap="large")

    with col_dados:
        # SEÇÃO DE BANCOS
        st.subheader("🏦 BANCOS (Liquidez)")
        for b in [c for c in contas if c['tipo'] == 'Corrente']:
            c1, c2 = st.columns([4, 1])
            c1.write(f"› {b['nome']}")
            c2.write(f"R$ {b['saldo_atual']:,.2f}")
        
        st.write("")
        
        # SEÇÃO DE CARTÕES (COM BARRA DE PROGRESSO)
        st.subheader("💳 CARTÕES DE CRÉDITO")
        st.caption("Name | Limite Usado vs. Disponível | Venc.")
        for c in [c for c in contas if c['tipo'] == 'Crédito']:
            usado = abs(c['saldo_atual'])
            limite = c['limite_total']
            percent = (usado / limite) if limite > 0 else 0
            
            # Layout da linha do cartão
            c_nome, c_barra, c_venc = st.columns([1, 2.5, 0.5])
            c_nome.write(f"**{c['nome']}**")
            c_barra.progress(min(percent, 1.0))
            c_venc.write(f"{c['dia_vencimento']:02d}")
            st.caption(f"Usado: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_acoes:
        # GRÁFICO DE VAZAMENTO
        st.subheader("🧐 ONDE ESTÁ O VAZAMENTO?")
        trans_data = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data
        if trans_data:
            df = pd.DataFrame(trans_data)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Cat'] = df_g['categorias'].apply(lambda x: x['nome'])
                st.bar_chart(df_g.groupby('Cat')['valor'].sum().abs())

        # FORMULÁRIOS DE REGISTRO
        st.subheader("⚡ NOVO GASTO/RECEBIMENTO")
        tipo_op = st.radio("Operação", ["Gasto", "Recebimento", "Pagamento de Fatura"], horizontal=True)

        with st.form("form_financeiro", clear_on_submit=True):
            if tipo_op != "Pagamento de Fatura":
                desc = st.text_input("Descrição (Ex: Gasolina)")
                val = st.number_input("Valor R$", min_value=0.0, format="%.2f")
                conta = st.selectbox("Conta/Cartão", [c['nome'] for c in contas])
                cat = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == ("Despesa" if tipo_op == "Gasto" else "Receita")])
            else:
                desc = "Pagamento de Fatura"
                val = st.number_input("Valor Pago R$", min_value=0.0, format="%.2f")
                conta_origem = st.selectbox("Sair dinheiro de:", [c['nome'] for c in contas if c['tipo'] == 'Corrente'])
                conta_destino = st.selectbox("Pagar Cartão:", [c['nome'] for c in contas if c['tipo'] == 'Crédito'])

            if st.form_submit_button("REGISTRAR"):
                if tipo_op != "Pagamento de Fatura":
                    c_id = next(i['id'] for i in contas if i['nome'] == conta)
                    cat_id = next(i['id'] for i in categorias if i['nome'] == cat)
                    val_final = -val if tipo_op == "Gasto" else val
                    conn.client.table("transacoes").insert({"descricao": desc, "valor": val_final, "conta_origem_id": c_id, "categoria_id": cat_id}).execute()
                else:
                    # Lógica dupla: tira do banco e abate no cartão
                    id_ori = next(i['id'] for i in contas if i['nome'] == conta_origem)
                    id_des = next(i['id'] for i in contas if i['nome'] == conta_destino)
                    conn.client.table("transacoes").insert({"descricao": f"Pagto Fatura {conta_destino}", "valor": -val, "conta_origem_id": id_ori}).execute()
                    conn.client.table("transacoes").insert({"descricao": f"Recebimento Fatura", "valor": val, "conta_origem_id": id_des}).execute()
                
                st.success("Registrado!")
                st.rerun()

except Exception as e:
    st.error(f"Erro ao carregar: {e}")
