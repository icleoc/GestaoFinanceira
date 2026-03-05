import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd
import plotly.express as px

# 1. Configuração do App
st.set_page_config(page_title="Jarvis Finance Pro", layout="wide")

# 2. CSS para os Cards Coloridos do seu Print (Fundo Escuro)
st.markdown("""
    <style>
    .card { padding: 20px; border-radius: 10px; margin-bottom: 10px; height: 130px; }
    .azul-escuro { background-color: #0b1e33; color: white; border-top: 5px solid #00d4ff; }
    .branco-card { background-color: #ffffff; color: #1e1e1e; border: 1px solid #ddd; }
    .salmao-card { background-color: #fff2ea; color: #d35400; border: 1px solid #fab1a0; }
    .stProgress > div > div > div > div { background-color: #00d4ff !important; }
    [data-testid="stMetricValue"] { font-size: 24px !important; }
    </style>
    """, unsafe_allow_html=True)

# 3. Conexão Protegida
try:
    conn = st.connection("supabase", type=SupabaseConnection)
    
    # Busca de dados
    contas = conn.client.table("contas").select("*").execute().data
    categorias = conn.client.table("categorias").select("*").execute().data
    trans_raw = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data

    # Cálculos das Métricas
    s_banco = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    d_card = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = s_banco + d_card + invest

    # --- HEADER IGUAL AO PRINT ---
    st.markdown("### SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    k1, k2, k3, k4 = st.columns(4)
    k1.markdown(f"<div class='card azul-escuro'><small>PATRIMÔNIO LÍQUIDO</small><br><h2>R$ {patrimonio:,.2f}</h2></div>", unsafe_allow_html=True)
    k2.markdown(f"<div class='card branco-card'><small>SALDO TOTAL EM BANCOS</small><br><h2>R$ {s_banco:,.2f}</h2></div>", unsafe_allow_html=True)
    k3.markdown(f"<div class='card salmao-card'><small>DÍVIDA TOTAL CARTÕES</small><br><h2>R$ {abs(d_card):,.2f}</h2></div>", unsafe_allow_html=True)
    k4.markdown(f"<div class='card branco-card'><small>INVESTIMENTOS TOTAL</small><br><h2>R$ {invest:,.2f}</h2></div>", unsafe_allow_html=True)

    st.write("")

    # --- DUAS COLUNAS PRINCIPAIS (1.2 : 1) ---
    col_lista, col_acoes = st.columns([1.2, 1], gap="large")

    with col_lista:
        st.markdown("#### VISÃO GERAL DE CONTAS E CARTÕES")
        
        with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                b1, b2 = st.columns([4, 1])
                b1.write(f"› {b['nome']}")
                b2.write(f"**R$ {b['saldo_atual']:,.2f}**")
        
        st.write("")
        
        with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
            st.markdown("<small>Name | Limite Usado vs. Disponível | Venc.</small>", unsafe_allow_html=True)
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                limite = c['limite_total']
                perc = (usado / limite) if limite > 0 else 0
                
                r1, r2, r3 = st.columns([1, 2.5, 0.5])
                r1.write(f"**{c['nome']}**")
                r2.progress(min(perc, 1.0))
                r3.write(f"{c['dia_vencimento']:02d}")
                st.caption(f"Gasto: R$ {usado:,.2f} / Limite: R$ {limite:,.2f}")

    with col_acoes:
        st.markdown("#### ONDE ESTÁ O VAZAMENTO?")
        if trans_raw:
            df = pd.DataFrame(trans_raw)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Categoria'] = df_g['categorias'].apply(lambda x: x['nome'] if x else 'Sem Categoria')
                # GRÁFICO DE DONUT CENTRALIZADO
                fig = px.pie(df_g, values=df_g['valor'].abs(), names='Categoria', hole=0.5)
                fig.update_layout(margin=dict(t=0, b=0, l=0, r=0), height=300)
                st.plotly_chart(fig, use_container_width=True)
        
        st.divider()
        
        # FORMULÁRIO DE REGISTRO
        st.markdown("#### ⚡ AÇÕES RÁPIDAS")
        tipo_op = st.radio("Operação:", ["Novo Gasto", "Receita", "Pagar Fatura"], horizontal=True)

        with st.form("form_v3", clear_on_submit=True):
            if tipo_op != "Pagar Fatura":
                desc = st.text_input("Descrição")
                val = st.number_input("Valor R$", min_value=0.0)
                conta_op = st.selectbox("Conta", [c['nome'] for c in contas])
                cat_op = st.selectbox("Categoria", [cat['nome'] for cat in categorias if cat['tipo'] == ("Despesa" if tipo_op == "Novo Gasto" else "Receita")])
            else:
                desc = "Pagamento de Fatura"
                val = st.number_input("Valor Pago R$", min_value=0.0)
                conta_op = st.selectbox("Sair dinheiro de (Banco):", [c['nome'] for c in contas if c['tipo'] == 'Corrente'])
                destino = st.selectbox("Pagar Cartão:", [c['nome'] for c in contas if c['tipo'] == 'Crédito'])

            if st.form_submit_button("REGISTRAR", use_container_width=True):
                # Execução no Supabase
                c_id = next(i['id'] for i in contas if i['nome'] == conta_op)
                if tipo_op != "Pagar Fatura":
                    cat_id = next(i['id'] for i in categorias if i['nome'] == cat_op)
                    v_final = -val if tipo_op == "Novo Gasto" else val
                    conn.client.table("transacoes").insert({"descricao": desc, "valor": v_final, "conta_origem_id": c_id, "categoria_id": cat_id}).execute()
                else:
                    d_id = next(i['id'] for i in contas if i['nome'] == destino)
                    conn.client.table("transacoes").insert({"descricao": f"Pagto {destino}", "valor": -val, "conta_origem_id": c_id}).execute()
                    conn.client.table("transacoes").insert({"descricao": "Recebimento Fatura", "valor": val, "conta_origem_id": d_id}).execute()
                st.rerun()

except Exception as e:
    st.error("Erro de Conexão com o Supabase. Verifique suas Secrets!")
    st.exception(e)
