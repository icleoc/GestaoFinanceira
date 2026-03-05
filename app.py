import streamlit as st
from st_supabase_connection import SupabaseConnection

# Configuração da Página
st.set_page_config(page_title="Jarvis Finance - Léo", layout="wide", page_icon="💰")

# Conexão com Supabase
conn = st.connection("supabase", type=SupabaseConnection)

# --- FUNÇÕES DE DADOS (Atualizadas para usar .client) ---
def get_contas():
    # Usando o cliente oficial do supabase via conexão do streamlit
    return conn.client.table("contas").select("*").execute()

def get_categorias():
    return conn.client.table("categorias").select("*").execute()

# --- SIDEBAR: LANÇAMENTO RÁPIDO ---
st.sidebar.header("🚀 Lançamento Rápido")
with st.sidebar.form("nova_transacao"):
    descricao = st.text_input("Descrição (Ex: Gasolina, Almoço)")
    valor = st.number_input("Valor (R$)", min_value=0.01, step=0.01)
    tipo = st.selectbox("Tipo", ["Despesa", "Receita"])
    
    # Busca contas
    try:
        contas_data = get_contas().data
        conta_nomes = {c['nome']: c['id'] for c in contas_data}
        conta_selecionada = st.selectbox("Conta/Cartão", list(conta_nomes.keys()))
    except:
        st.error("Erro ao carregar contas. Verifique o banco.")
        conta_selecionada = None
    
    # Busca categorias
    try:
        cats_data = get_categorias().data
        cat_nomes = {cat['nome']: cat['id'] for cat in cats_data if cat['tipo'] == tipo}
        cat_selecionada = st.selectbox("Categoria", list(cat_nomes.keys()))
    except:
        st.error("Erro ao carregar categorias.")
        cat_selecionada = None
    
    # BOTÃO DE ENVIO (Corrige o erro de 'Missing Submit Button')
    btn_salvar = st.form_submit_button("Registrar Agora")

    if btn_salvar and conta_selecionada and cat_selecionada:
        valor_final = -valor if tipo == "Despesa" else valor
        data_insert = {
            "descricao": descricao,
            "valor": valor_final,
            "conta_origem_id": conta_nomes[conta_selecionada],
            "categoria_id": cat_nomes[cat_selecionada]
        }
        
        try:
            conn.client.table("transacoes").insert(data_insert).execute()
            st.sidebar.success("Registrado com sucesso!")
            st.rerun()
        except Exception as e:
            st.sidebar.error(f"Erro ao salvar: {e}")

# --- DASHBOARD ---
st.title("💰 Jarvis Finance")
if 'contas_data' in locals():
    # Cálculo de Métricas
    saldo_bancos = sum(c['saldo_atual'] for c in contas_data if c['tipo'] in ['Corrente', 'Investimento'])
    divida_cartoes = sum(c['saldo_atual'] for c in contas_data if c['tipo'] == 'Crédito')
    
    c1, c2, c3 = st.columns(3)
    c1.metric("Patrimônio Líquido", f"R$ {saldo_bancos + divida_cartoes:,.2f}")
    c2.metric("Saldo Bancos", f"R$ {saldo_bancos:,.2f}")
    c3.metric("Dívida Cartões", f"R$ {abs(divida_cartoes):,.2f}")
