import streamlit as st
from st_supabase_connection import SupabaseConnection
import pandas as pd

# 1. Configuração da Página
st.set_page_config(page_title="Jarvis Finance", layout="wide", page_icon="💎")

# 2. CSS CUSTOMIZADO (Visual de Dashboard de Trading/Premium)
st.markdown("""
    <style>
    /* Fundo e Container */
    .stApp { background-color: #0b0e14; }
    
    /* Cards de Métricas */
    [data-testid="stMetric"] {
        background-color: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        padding: 20px !important;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    }
    
    /* Estilização das Barras de Progresso */
    .stProgress > div > div > div > div {
        background-image: linear-gradient(to right, #00ff88, #00d4ff);
    }

    /* Títulos e Subtítulos */
    h1, h2, h3 { color: #ffffff !important; font-family: 'Inter', sans-serif; }
    
    /* Tabelas e Dataframes */
    .stDataFrame { border: 1px solid #30363d; border-radius: 10px; }
    
    /* Customizar Expanders */
    .streamlit-expanderHeader { background-color: #161b22 !important; border-radius: 8px !important; border: 1px solid #30363d !important; }
    </style>
    """, unsafe_allow_html=True)

# 3. Conexão
conn = st.connection("supabase", type=SupabaseConnection)

# --- FUNÇÕES ---
def get_data(table):
    return conn.client.table(table).select("*").execute().data

def get_trans():
    return conn.client.table("transacoes").select("data, descricao, valor, contas(nome), categorias(nome)").order("criado_em", desc=True).limit(10).execute().data

# --- CARREGAMENTO ---
try:
    contas = get_data("contas")
    cats = get_data("categorias")
    recentes = get_trans()

    # Cálculos
    saldo_bancos = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Corrente')
    divida_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Crédito')
    invest_total = sum(c['saldo_atual'] for c in contas if c['tipo'] == 'Investimento')
    patrimonio = saldo_bancos + divida_total + invest_total

    # --- HEADER ---
    st.markdown("### 💎 SISTEMA FINANCEIRO LÉO - CONTROLE TOTAL")
    
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("PATRIMÔNIO LÍQUIDO", f"R$ {patrimonio:,.2f}")
    m2.metric("SALDO EM BANCOS", f"R$ {saldo_bancos:,.2f}")
    m3.metric("DÍVIDA CARTÕES", f"R$ {abs(divida_total):,.2f}", delta="- Risco" if abs(divida_total) < 5000 else "+ Risco")
    m4.metric("INVESTIMENTOS", f"R$ {invest_total:,.2f}")

    st.divider()

    col_esq, col_dir = st.columns([1.5, 1], gap="large")

    with col_esq:
        st.subheader("📊 GESTÃO DE ATIVOS E PASSIVOS")
        
        with st.expander("🏦 CONTAS BANCÁRIAS", expanded=True):
            for b in [c for c in contas if c['tipo'] == 'Corrente']:
                c_b1, c_b2 = st.columns([4, 1])
                c_b1.write(f"🔹 {b['nome']}")
                c_b2.write(f"**R$ {b['saldo_atual']:,.2f}**")

        with st.expander("💳 CARTÕES (LIMITE E VENCIMENTO)", expanded=True):
            for c in [c for c in contas if c['tipo'] == 'Crédito']:
                usado = abs(c['saldo_atual'])
                dispo = c['limite_total'] - usado
                perc = (usado / c['limite_total']) if c['limite_total'] > 0 else 0
                
                col_n, col_v = st.columns([4, 1])
                col_n.markdown(f"**{c['nome']}** | <small>Disponível: R$ {dispo:,.2f}</small>", unsafe_allow_html=True)
                col_v.write(f"📅 {c['dia_vencimento']:02d}")
                
                st.progress(min(perc, 1.0))
                st.caption(f"Fatura Atual: R$ {usado:,.2f} / Limite: R$ {c['limite_total']:,.2f}")

    with col_dir:
        st.subheader("⚡ AÇÕES E VAZAMENTOS")
        
        tab_add, tab_transf = st.tabs(["➕ Lançar", "🔄 Transferir/Pagar"])
        
        with tab_add:
            with st.form("form_add", clear_on_submit=True):
                desc = st.text_input("Descrição")
                val = st.number_input("Valor", min_value=0.01)
                origem = st.selectbox("Origem", [c['nome'] for c in contas])
                cat = st.selectbox("Categoria", [ct['nome'] for ct in cats if ct['tipo'] == 'Despesa'])
                if st.form_submit_button("REGISTRAR GASTO", use_container_width=True):
                    c_id = next(i['id'] for i in contas if i['nome'] == origem)
                    ca_id = next(i['id'] for i in cats if i['nome'] == cat)
                    conn.client.table("transacoes").insert({"descricao": desc, "valor": -val, "conta_origem_id": c_id, "categoria_id": ca_id}).execute()
                    st.rerun()

        with tab_transf:
            st.info("Use para pagar fatura ou passar dívida de um cartão para outro.")
            with st.form("form_transf"):
                # "Onde o dinheiro sai/a dívida aumenta"
                de_onde = st.selectbox("Sair dinheiro de (ou usar limite de):", [c['nome'] for c in contas])
                # "Onde o dinheiro entra/a dívida diminui"
                para_onde = st.selectbox("Pagar / Enviar para:", [c['nome'] for c in contas])
                v_transf = st.number_input("Valor da operação", min_value=0.01)
                
                if st.form_submit_button("CONFIRMAR OPERAÇÃO", use_container_width=True):
                    id_sai = next(i['id'] for i in contas if i['nome'] == de_onde)
                    id_entra = next(i['id'] for i in contas if i['nome'] == para_onde)
                    
                    # 1. Registra a saída (valor negativo) na conta de origem
                    conn.client.table("transacoes").insert({"descricao": f"Transf para {para_onde}", "valor": -v_transf, "conta_origem_id": id_sai}).execute()
                    # 2. Registra a entrada (valor positivo) na conta de destino
                    conn.client.table("transacoes").insert({"descricao": f"Transf de {de_onde}", "valor": v_transf, "conta_origem_id": id_entra}).execute()
                    st.success("Operação realizada!")
                    st.rerun()

        # Mini Gráfico de Vazamento
        if recentes:
            df = pd.DataFrame(recentes)
            df_g = df[df['valor'] < 0].copy()
            if not df_g.empty:
                df_g['Cat'] = df_g['categorias'].apply(lambda x: x['nome'])
                st.write("**Resumo de Gastos**")
                st.bar_chart(df_g.groupby('Cat')['valor'].sum().abs())

except Exception as e:
    st.error(f"Erro: {e}")
