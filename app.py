import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd

# 1. Configuração da Página (Título e Layout Largo)
st.set_page_config(page_title="Jarvis Finance - Léo", layout="wide", page_icon="💰")

# 2. Conexão com Supabase
conn = st.connection("supabase", type=SupabaseConnection)

# 3. Funções de Dados
def get_contas():
    return conn.client.table("contas").select("*").execute()

def get_categorias():
    return conn.client.table("categorias").select("*").execute()

def get_ultimas_transacoes():
    return conn.client.table("transacoes").select("data, descricao, valor, contas(nome), categorias(nome)").order("criado_em", desc=True).limit(10).execute()

# --- SIDEBAR: LANÇAMENTO RÁPIDO ---
st.sidebar.header("🚀 Lançamento Rápido")
with st.sidebar.form("nova_transacao"):
    desc = st.text_input("Descrição (Ex: Gasolina, Almoço)")
    valor = st.number_input("Valor (R$)", min_value=0.01, step=0.01)
    tipo = st.selectbox("Tipo", ["Despesa", "Receita"])
    
    # Carregando dados para os selects
    contas_raw = get_contas().data
    conta_nomes = {c['nome']: c['id'] for c in contas_raw}
    conta_selecionada = st.selectbox("Conta/Cartão", list(conta_nomes.keys()))
    
    cats_raw = get_categorias().data
    cat_nomes = {cat['nome']: cat['id'] for cat in cats_raw if cat['tipo'] == tipo}
    cat_selecionada = st.selectbox("Categoria", list(cat_nomes.keys()))
    
    if st.form_submit_button("Registrar Agora"):
        final_val = -valor if tipo == "Despesa" else valor
        data_insert = {
            "descricao": desc,
            "valor": final_val,
            "conta_origem_id": conta_nomes[conta_selecionada],
            "categoria_id": cat_nomes[cat_selecionada]
        }
        conn.client.table("transacoes").insert(data_insert).execute()
        st.sidebar.success("Registrado!")
        st.rerun()

# --- DASHBOARD PRINCIPAL (O Visual da Prévia) ---
st.title("💰 SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")

# Cálculos de Topo
contas_data = get_contas().data
saldo_bancos = sum(c['saldo_atual'] for c in contas_data if c['tipo'] in ['Corrente', 'Investimento'])
divida_cards = sum(c['saldo_atual'] for c in contas_data if c['tipo'] == 'Crédito')
invest_total = sum(c['saldo_atual'] for c in contas_data if c['tipo'] == 'Investimento')

m1, m2, m3, m4 = st.columns(4)
m1.metric("PATRIMÔNIO LÍQUIDO", f"R$ {saldo_bancos + divida_cards:,.2f}")
m2.metric("SALDO TOTAL EM BANCOS", f"R$ {saldo_bancos - invest_total:,.2f}")
m3.metric("DÍVIDA CARTÕES (Aberto)", f"R$ {abs(divida_cards):,.2f}")
m4.metric("INVESTIMENTOS TOTAL", f"R$ {invest_total:,.2f}")

st.divider()

# Colunas Principais: Visão Geral vs Onde está o vazamento
col_esquerda, col_direita = st.columns([1.2, 1])

with col_esquerda:
    st.subheader("📊 VISÃO GERAL DE CONTAS E CARTÕES")
    
    # Seção de Bancos
    with st.expander("🏦 BANCOS (Liquidez)", expanded=True):
        for b in [c for c in contas_data if c['tipo'] == 'Corrente']:
            c1, c2 = st.columns([3, 1])
            c1.write(f"**{b['nome']}**")
            c2.write(f"R$ {b['saldo_atual']:,.2f}")
    
    # Seção de Cartões (Estilo a prévia)
    with st.expander("💳 CARTÕES DE CRÉDITO", expanded=True):
        st.write("Name | Limite Usado vs. Disponível | Venc.")
        for card in [c for c in contas_data if c['tipo'] == 'Crédito']:
            usado = abs(card['saldo_atual'])
            limite = card['limite_total']
            percent = (usado / limite) if limite > 0 else 0
            venc = card['dia_vencimento']
            
            # Layout de linha de cartão
            c_name, c_prog, c_venc = st.columns([1, 2.5, 0.5])
            c_name.write(card['nome'])
            c_prog.progress(min(percent, 1.0))
            c_venc.write(f"{venc:02d}")
            st.caption(f"Usado: R$ {usado:,.2f} / Limite Total: R$ {limite:,.2f}")

with col_direita:
    st.subheader("🧐 ONDE ESTÁ O VAZAMENTO?")
    
    # Gráfico de Gastos por Categoria
    trans_data = conn.client.table("transacoes").select("valor, categorias(nome)").execute().data
    if trans_data:
        df = pd.DataFrame(trans_data)
        df_gastos = df[df['valor'] < 0].copy()
        if not df_gastos.empty:
            df_gastos['valor'] = df_gastos['valor'].abs()
            df_gastos['Cat'] = df_gastos['categorias'].apply(lambda x: x['nome'])
            g_cat = df_gastos.groupby('Cat')['valor'].sum()
            st.write("**Gastos por Categoria (Este Mês)**")
            st.pie_chart(g_cat)
        else:
            st.info("Sem despesas registradas ainda.")
    
    # Tabela de Últimas Transações
    st.subheader("📑 ÚLTIMAS MOVIMENTAÇÕES")
    ultimas = get_ultimas_transacoes().data
    if ultimas:
        # Formatando para tabela limpa
        df_ultimas = pd.DataFrame(ultimas)
        # Ajustando nomes das colunas vindas das relações do Supabase
        df_ultimas['Conta'] = df_ultimas['contas'].apply(lambda x: x['nome'])
        df_ultimas['Categoria'] = df_ultimas['categorias'].apply(lambda x: x['nome'])
        st.dataframe(df_ultimas[['data', 'descricao', 'valor', 'Conta', 'Categoria']], use_container_width=True)
