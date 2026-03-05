import streamlit as st
from st_supabase_connection import SupabaseConnection

# Configuração da Página
st.set_page_config(page_title="Jarvis Finance - Léo", layout="wide", page_icon="💰")

# Conexão com Supabase
# Certifique-se de adicionar as secrets (URL e API KEY) no seu ambiente Streamlit
conn = st.connection("supabase", type=SupabaseConnection)

def get_contas():
    return conn.query("*", table="contas").execute()

def get_categorias():
    return conn.query("*", table="categorias").execute()

# --- SIDEBAR: LANÇAMENTO RÁPIDO ---
st.sidebar.header("🚀 Lançamento Rápido")
with st.sidebar.form("nova_transacao"):
    descricao = st.text_input("Descrição (Ex: Gasolina, Almoço)")
    valor = st.number_input("Valor (R$)", min_value=0.01, step=0.01)
    tipo = st.selectbox("Tipo", ["Despesa", "Receita"])
    
    # Busca contas para o Selectbox
    contas_data = get_contas().data
    conta_nomes = {c['nome']: c['id'] for c in contas_data}
    conta_selecionada = st.selectbox("Conta/Cartão", list(conta_nomes.keys()))
    
    # Busca categorias
    cats_data = get_categorias().data
    cat_nomes = {cat['nome']: cat['id'] for cat in cats_data if cat['tipo'] == tipo}
    cat_selecionada = st.selectbox("Categoria", list(cat_nomes.keys()))
    
    btn_salvar = st.form_submit_button("Registrar Agora")

    if btn_salvar:
        # Se for despesa, o valor entra negativo no banco para o Trigger subtrair do saldo
        valor_final = -valor if tipo == "Despesa" else valor
        
        data_insert = {
            "descricao": descricao,
            "valor": valor_final,
            "conta_origem_id": conta_nomes[conta_selecionada],
            "categoria_id": cat_nomes[cat_selecionada]
        }
        
        try:
            conn.table("transacoes").insert(data_insert).execute()
            st.sidebar.success("Registrado com sucesso!")
            st.rerun()
        except Exception as e:
            st.sidebar.error(f"Erro ao salvar: {e}")

# --- DASHBOARD PRINCIPAL ---
st.title("💰 Jarvis Finance - Controle Total")

# Cálculo de Métricas
resumo_contas = get_contas().data
saldo_bancos = sum(c['saldo_atual'] for c in resumo_contas if c['tipo'] in ['Corrente', 'Investimento'])
divida_cartoes = sum(c['saldo_atual'] for c in resumo_contas if c['tipo'] == 'Crédito')
patrimonio = saldo_bancos + divida_cartoes # divida_cartoes já é negativa no BD

col1, col2, col3 = st.columns(3)
col1.metric("Patrimônio Líquido", f"R$ {patrimonio:,.2f}")
col2.metric("Saldo em Bancos", f"R$ {saldo_bancos:,.2f}")
col3.metric("Dívida Cartões (Fatura)", f"R$ {abs(divida_cartoes):,.2f}", delta_color="inverse")

st.divider()

# --- VISÃO DE CARTÕES E LIMITES ---
st.subheader("💳 Meus Cartões (Uso do Limite)")
cols_cards = st.columns(len([c for c in resumo_contas if c['tipo'] == 'Crédito']))

idx = 0
for conta in resumo_contas:
    if conta['tipo'] == 'Crédito':
        with cols_cards[idx]:
            # Cálculo de uso (saldo_atual no cartão é quanto já gastou, ex: -1500)
            gastou = abs(conta['saldo_atual'])
            limite = conta['limite_total']
            percentual = (gastou / limite) if limite > 0 else 0
            
            st.write(f"**{conta['nome']}**")
            st.progress(min(percentual, 1.0))
            st.caption(f"Gasto: R$ {gastou:,.2f} / Limite: R$ {limite:,.2f}")
            st.caption(f"Vence dia: {conta['dia_vencimento']}")
        idx += 1

st.divider()

# --- TABELA DE ÚLTIMAS TRANSAÇÕES ---
st.subheader("📑 Últimas Movimentações")
transacoes = conn.query("data, descricao, valor, contas(nome), categorias(nome)", table="transacoes").order("data", desc=True).limit(10).execute()

if transacoes.data:
    st.table(transacoes.data)
else:
    st.info("Nenhuma transação encontrada.")
