import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd

# 1. Configuração da Página
st.set_page_config(page_title="Jarvis Finance - Léo", layout="wide", page_icon="🏦")

# 2. CSS Customizado para um visual "Clean & Modern"
st.markdown("""
    <style>
    .main { background-color: #f8f9fa; }
    .stMetric {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border-left: 5px solid #007bff;
    }
    .card-conta {
        background-color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        border-left: 4px solid #28a745;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .card-cartao {
        background-color: white;
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 10px;
        border-left: 4px solid #dc3545;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    div[data-testid="stExpander"] {
        border: none !important;
        box-shadow: none !important;
    }
    </style>
    """, unsafe_allow_html=True)

# 3. Conexão
conn = st.connection("supabase", type=SupabaseConnection)

# --- FUNÇÕES DE BUSCA ---
@st.cache_data(ttl=60)
def get_data(table):
    return conn.client.table(table).select("*").execute().data

def get_full_trans():
    return conn.client.table("transacoes").select("data, descricao, valor, contas(nome), categorias(nome)").order("criado_em", desc=True).limit(15).execute().data

# --- HEADER ---
st.title("🏦 Jarvis Finance")
st.caption("Controle Financeiro de Alto Nível")

# 4. CARREGAMENTO DE DADOS
try:
    contas = get_data("contas")
    cats = get_data("categorias")
    trans_recentes = get_full_trans()

    # Cálculos
    saldo_real = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    invest_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    divida_cartoes = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    patrimonio = saldo_real + invest_total + divida_cartoes

    # MÉTRICAS PRINCIPAIS
    m1, m2, m3, m4 = st.columns(4)
    with m1: st.metric("Patrimônio Líquido", f"R$ {patrimonio:,.2f}")
    with m2: st.metric("Saldo Bancos", f"R$ {saldo_real:,.2f}")
    with m3: st.metric("Investimentos", f"R$ {invest_total:,.2f}")
    with m4: st.metric("Dívida Cartões", f"R$ {abs(divida_cartoes):,.2f}", delta_color="inverse")

    st.markdown("---")

    # --- CORPO DO SISTEMA ---
    col_dados, col_acoes = st.columns([2, 1], gap="large")

    with col_dados:
        tab1, tab2, tab3 = st.tabs(["📊 Dash", "💳 Cartões", "📜 Extrato"])
        
        with tab1:
            st.subheader("Análise de Gastos")
            if trans_recentes:
                df = pd.DataFrame(trans_recentes)
                df_despesas = df[df['valor'] < 0].copy()
                if not df_despesas.empty:
                    df_despesas['abs_valor'] = df_despesas['valor'].abs()
                    df_despesas['Categoria'] = df_despesas['categorias'].apply(lambda x: x['nome'])
                    # Gráfico de barras horizontal mais intuitivo que a pizza
                    st.bar_chart(df_despesas.groupby('Categoria')['abs_valor'].sum())
                else:
                    st.info("Lance gastos para visualizar o gráfico.")

        with tab2:
            st.subheader("Limite dos Cartões")
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                limite = c['limite_total']
                percent = (usado / limite) if limite > 0 else 0
                
                col_c1, col_c2 = st.columns([3, 1])
                col_c1.markdown(f"**{c['nome']}** (Venc: {c['dia_vencimento']:02d})")
                col_c2.write(f"R$ {limite - usado:,.2f} livre")
                
                # Barra de cor dinâmica
                cor = "red" if percent > 0.8 else "orange" if percent > 0.5 else "green"
                st.progress(min(percent, 1.0))
                st.caption(f"Usado: R$ {usado:,.2f} / Total: R$ {limite:,.2f}")
                st.write("")

        with tab3:
            st.subheader("Últimas 15 movimentações")
            if trans_recentes:
                df_t = pd.DataFrame(trans_recentes)
                df_t['Conta'] = df_t['contas'].apply(lambda x: x['nome'])
                df_t['Categoria'] = df_t['categorias'].apply(lambda x: x['nome'])
                st.dataframe(df_t[['data', 'descricao', 'valor', 'Conta', 'Categoria']], use_container_width=True)

    with col_acoes:
        st.subheader("⚡ Ações")
        
        # FORMULÁRIO DE LANÇAMENTO COM DESIGN MELHORADO
        with st.expander("➕ Novo Lançamento", expanded=True):
            with st.form("quick_add", clear_on_submit=True):
                desc = st.text_input("O que você comprou?")
                val = st.number_input("Valor", min_value=0.01)
                t_tipo = st.radio("Tipo", ["Despesa", "Receita"], horizontal=True)
                
                c_selecionada = st.selectbox("Onde?", [c['nome'] for c in contas])
                cat_selecionada = st.selectbox("Categoria", [cat['nome'] for cat in cats if cat['tipo'] == t_tipo])
                
                if st.form_submit_button("Lançar Agora", use_container_width=True):
                    c_id = next(item['id'] for item in contas if item['nome'] == c_selecionada)
                    cat_id = next(item['id'] for item in cats if item['nome'] == cat_selecionada)
                    val_final = -val if t_tipo == "Despesa" else val
                    
                    conn.client.table("transacoes").insert({
                        "descricao": desc, "valor": val_final, 
                        "conta_origem_id": c_id, "categoria_id": cat_id
                    }).execute()
                    st.toast("Lançamento concluído!", icon="✅")
                    st.rerun()

        # SEÇÃO DE BANCOS (Lado direito para não poluir o centro)
        with st.expander("💰 Meus Saldos", expanded=False):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                st.markdown(f"""
                <div class="card-conta">
                    <small>{b['nome']}</small><br>
                    <b>R$ {b['saldo_atual']:,.2f}</b>
                </div>
                """, unsafe_allow_html=True)

except Exception as e:
    st.error(f"Erro ao carregar o Jarvis Finance: {e}")
    st.info("Verifique se as tabelas no Supabase foram criadas corretamente.")
