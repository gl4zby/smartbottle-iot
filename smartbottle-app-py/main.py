from kivy.config import Config
Config.set('kivy', 'keyboard_mode', 'system')
Config.set('graphics', 'width', '400')
Config.set('graphics', 'height', '750')

from kivy.app import App
from kivy.lang import Builder
from kivy.properties import StringProperty, NumericProperty, ListProperty
from kivy.uix.screenmanager import ScreenManager, Screen
from kivy.clock import Clock

import api


# =========================
# Estado simples da aplicação
# =========================
class RootState:
    user = None  # dict: {"userId": int, "nome": str}


state = RootState()


# =========================
# Ecrãs
# =========================
class LoginScreen(Screen):
    error = StringProperty("")
    server_info = StringProperty("")

    def on_enter(self):
        """Atualizar informação do servidor ao entrar no ecrã de login."""
        self.server_info = f"Servidor: {api.get_api_url()}"

    def show_server_config(self):
        """Mostrar popup para configurar o servidor da API."""
        from kivy.uix.popup import Popup
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.textinput import TextInput
        from kivy.uix.button import Button

        content = BoxLayout(orientation="vertical", padding=16, spacing=12)
        content.add_widget(Label(text="Configurar Servidor API", font_size="18sp", bold=True, size_hint_y=None, height="32dp"))
        content.add_widget(Label(text="Exemplo: http://192.168.0.101:5000", font_size="12sp", size_hint_y=None, height="24dp"))

        url_input = TextInput(text=api.get_api_url(), multiline=False, size_hint_y=None, height="40dp")
        content.add_widget(url_input)

        btn_box = BoxLayout(orientation="horizontal", size_hint_y=None, height="48dp", spacing=8)
        popup = Popup(title="Configurar Servidor", content=content, size_hint=(0.9, 0.5))

        btn_cancel = Button(text="Cancelar", background_color=(0.6, 0.6, 0.6, 1), background_normal='')
        btn_cancel.bind(on_release=popup.dismiss)

        btn_save = Button(text="Guardar", background_color=(0.13, 0.59, 0.95, 1), background_normal='')
        btn_save.bind(on_release=lambda x: self.save_server_url(popup, url_input.text))

        btn_box.add_widget(btn_cancel)
        btn_box.add_widget(btn_save)
        content.add_widget(btn_box)

        popup.open()

    def save_server_url(self, popup, url):
        """Guardar o URL da API."""
        url = url.strip()
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "http://" + url
        url = url.rstrip("/")

        api.save_config(api_url=url)
        self.server_info = f"Servidor: {url}"
        self.error = "Servidor configurado!"
        popup.dismiss()

    def do_login(self):
        self.error = ""
        email = self.ids.email.text.strip()
        password = self.ids.password.text.strip()
        try:
            data = api.login(email, password)
            state.user = {"userId": data["userId"], "nome": data["nome"]}
            self.manager.current = "dashboard"
            Clock.schedule_once(lambda *_: self.manager.get_screen("dashboard").load_data(), 0.05)
        except Exception as e:
            self.error = msg_from_exc(e)


class RegisterScreen(Screen):
    error = StringProperty("")
    success = StringProperty("")

    def do_register(self):
        self.error = ""
        self.success = ""
        nome = self.ids.nome.text.strip()
        email = self.ids.reg_email.text.strip()
        password = self.ids.reg_password.text.strip()
        try:
            api.registo(nome, email, password)
            self.success = "Conta criada. Já podes iniciar sessão."
        except Exception as e:
            self.error = msg_from_exc(e)


class DashboardScreen(Screen):
    welcome = StringProperty("")
    total_hoje = NumericProperty(0.0)
    weekly_average = NumericProperty(0.0)
    streak = NumericProperty(0)
    cafes_hoje = NumericProperty(0)
    items = ListProperty([])
    progress_percent = NumericProperty(0.0)
    progress_text = StringProperty("0%")
    progress_color = ListProperty([0.96, 0.26, 0.21, 1])  # Vermelho por defeito
    daily_goal = NumericProperty(2000)  # Objetivo diário em ml
    status_msg = StringProperty("")

    def on_pre_enter(self):
        if state.user:
            self.welcome = f"Olá, {state.user['nome']}"
            # Recarregar sempre os dados ao entrar no ecrã do dashboard
            Clock.schedule_once(lambda dt: self.load_data(), 0.1)

    def load_data(self):
        try:
            data = api.listar_consumo(state.user["userId"])
            print(f"[DEBUG] load_data: Recebidos {len(data)} registos da API")
            print(f"[DEBUG] load_data: Primeiros dados = {data[:2] if data else 'vazio'}")
            self.items = data
            self.total_hoje = calcula_total_hoje_litros(data)
            self.weekly_average = calcula_media_semanal(data)
            self.streak = calcula_streak(data)
            self.cafes_hoje = conta_cafes_hoje(data)
            self.daily_goal = api.get_daily_goal()  # Atualizar objetivo diário
            print(f"[DEBUG] load_data: Agua hoje={self.total_hoje}L, Cafes hoje={self.cafes_hoje}, Meta={self.daily_goal}ml")
            self.update_progress()
            self.render_list()
            self.status_msg = ""
        except Exception as e:
            print(f"[DEBUG] load_data ERROR: {e}")
            self.status_msg = msg_from_exc(e)

    def refresh_data(self):
        """Atualizar dados com feedback visual."""
        # Mostrar mensagem de carregamento
        self.status_msg = "A atualizar..."
        # Agendar a atualização com pequeno atraso para a mensagem aparecer primeiro
        Clock.schedule_once(lambda dt: self._do_refresh(), 0.1)

    def _do_refresh(self):
        """Executar a atualização propriamente dita."""
        try:
            self.load_data()
            self.status_msg = "Atualizado!"
            # Limpar mensagem após 2 segundos
            Clock.schedule_once(lambda dt: setattr(self, 'status_msg', ''), 2)
        except Exception as e:
            self.status_msg = msg_from_exc(e)

    def update_progress(self):
        """Calcular a percentagem de progresso e a cor."""
        daily_goal = api.get_daily_goal()
        total_ml = self.total_hoje * 1000  # Converter litros para ml

        # Calcular percentagem
        percent = min((total_ml / daily_goal) * 100, 100) if daily_goal > 0 else 0
        self.progress_percent = percent
        self.progress_text = f"{int(percent)}%"

        print(f"[DEBUG] update_progress: daily_goal={daily_goal}ml, total_hoje={self.total_hoje}L ({total_ml}ml), percent={percent}%")

        # Determinar cor baseada no progresso
        if percent < 33:
            self.progress_color = [0.96, 0.26, 0.21, 1]  # Vermelho
        elif percent < 67:
            self.progress_color = [1.0, 0.76, 0.03, 1]   # Laranja/Amarelo
        elif percent < 100:
            self.progress_color = [1.0, 0.92, 0.23, 1]   # Amarelo
        else:
            self.progress_color = [0.30, 0.69, 0.31, 1]  # Verde

    def render_list(self):
        """Renderiza o histórico no GridLayout (ids.list_hist)."""
        print(f"[DEBUG] render_list: Iniciando. self.items tem {len(self.items)} registos")
        try:
            gl = self.ids.list_hist
            gl.clear_widgets()

            from kivy.uix.boxlayout import BoxLayout
            from kivy.uix.label import Label
            from kivy.uix.button import Button

            if not self.items:
                print("[DEBUG] render_list: Lista vazia, adicionando mensagem 'Sem registos'")
                gl.add_widget(Label(text="Sem registos.", size_hint_y=None, height="32dp"))
                return

            print(f"[DEBUG] render_list: A renderizar {len(self.items)} items")
            # Cor de texto preto puro para máxima visibilidade
            text_color = (0, 0, 0, 1)  # Preto puro

            for i, r in enumerate(self.items):
                record_id = r.get("id")
                tipo = str(r.get("tipo_bebida") or "Água")
                qml = str(r.get("quantidade_ml") or "0")
                data = str(r.get("data_registo") or "N/A")[:16]
                print(f"[DEBUG] render_list: Item {i}: id={record_id}, tipo={tipo}, qml={qml}, data={data}")

                linha = BoxLayout(orientation="horizontal", size_hint_y=None, height="48dp", padding=(4, 2), spacing=4)

                # Secção de informação
                info_box = BoxLayout(orientation="vertical", size_hint_x=0.55)
                info_box.add_widget(Label(text=f"{tipo} - {qml} ml", color=text_color, font_size="14sp", bold=True, halign="left", text_size=(None, None)))
                info_box.add_widget(Label(text=data, color=(0.5, 0.5, 0.5, 1), font_size="11sp", halign="left", text_size=(None, None)))
                linha.add_widget(info_box)

                # Botão editar
                btn_edit = Button(
                    text="[E]",
                    size_hint_x=0.2,
                    background_color=(0.13, 0.59, 0.95, 1),
                    background_normal='',
                    color=(1, 1, 1, 1),
                    font_size="12sp",
                    bold=True
                )
                btn_edit.bind(on_release=lambda x, rid=record_id, t=tipo, q=qml: self.show_edit_popup(rid, t, q))
                linha.add_widget(btn_edit)

                # Botão eliminar
                btn_delete = Button(
                    text="[X]",
                    size_hint_x=0.2,
                    background_color=(0.96, 0.26, 0.21, 1),
                    background_normal='',
                    color=(1, 1, 1, 1),
                    font_size="12sp",
                    bold=True
                )
                btn_delete.bind(on_release=lambda x, rid=record_id: self.show_delete_confirm(rid))
                linha.add_widget(btn_delete)

                gl.add_widget(linha)
            print(f"[DEBUG] render_list: Concluído! {len(gl.children)} widgets adicionados")
        except Exception as e:
            print(f"[DEBUG] render_list ERROR: {e}")
            import traceback
            traceback.print_exc()

    def show_edit_popup(self, record_id, tipo, quantidade):
        """Mostrar popup para editar um registo de consumo."""
        from kivy.uix.popup import Popup
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.textinput import TextInput
        from kivy.uix.button import Button
        from kivy.uix.spinner import Spinner

        content = BoxLayout(orientation="vertical", padding=16, spacing=12)

        content.add_widget(Label(text="Editar Registo", font_size="18sp", bold=True, size_hint_y=None, height="32dp"))

        # Input da quantidade
        content.add_widget(Label(text="Quantidade (ml):", size_hint_y=None, height="24dp", halign="left"))
        quantidade_input = TextInput(text=str(quantidade), input_filter="int", multiline=False, size_hint_y=None, height="40dp")
        content.add_widget(quantidade_input)

        # Spinner do tipo
        content.add_widget(Label(text="Tipo:", size_hint_y=None, height="24dp", halign="left"))
        tipo_spinner = Spinner(text=tipo, values=["Água", "Café", "Chá"], size_hint_y=None, height="40dp")
        content.add_widget(tipo_spinner)

        # Botões
        btn_box = BoxLayout(orientation="horizontal", size_hint_y=None, height="48dp", spacing=8)

        popup = Popup(title="Editar Consumo", content=content, size_hint=(0.9, 0.5))

        btn_cancel = Button(text="Cancelar", background_color=(0.6, 0.6, 0.6, 1), background_normal='')
        btn_cancel.bind(on_release=popup.dismiss)

        btn_save = Button(text="Guardar", background_color=(0.13, 0.59, 0.95, 1), background_normal='')
        btn_save.bind(on_release=lambda x: self.do_edit_record(popup, record_id, quantidade_input.text, tipo_spinner.text))

        btn_box.add_widget(btn_cancel)
        btn_box.add_widget(btn_save)
        content.add_widget(btn_box)

        popup.open()

    def do_edit_record(self, popup, record_id, quantidade, tipo):
        """Executar a operação de edição."""
        try:
            quantidade_ml = int(quantidade)
            if quantidade_ml <= 0:
                return
            api.update_consumo(record_id, quantidade_ml, tipo)
            popup.dismiss()
            self.load_data()  # Atualizar dashboard
        except Exception as e:
            print(f"[ERROR] do_edit_record: {e}")

    def show_delete_confirm(self, record_id):
        """Mostrar popup de confirmação antes de eliminar."""
        from kivy.uix.popup import Popup
        from kivy.uix.boxlayout import BoxLayout
        from kivy.uix.label import Label
        from kivy.uix.button import Button

        content = BoxLayout(orientation="vertical", padding=16, spacing=12)
        content.add_widget(Label(text="Tem a certeza que\ndeseja eliminar\neste registo?", font_size="16sp", halign="center"))

        btn_box = BoxLayout(orientation="horizontal", size_hint_y=None, height="48dp", spacing=8)

        popup = Popup(title="Confirmar Eliminacao", content=content, size_hint=(0.8, 0.35))

        btn_cancel = Button(text="Nao", background_color=(0.6, 0.6, 0.6, 1), background_normal='')
        btn_cancel.bind(on_release=popup.dismiss)

        btn_confirm = Button(text="Sim", background_color=(0.96, 0.26, 0.21, 1), background_normal='')
        btn_confirm.bind(on_release=lambda x: self.do_delete_record(popup, record_id))

        btn_box.add_widget(btn_cancel)
        btn_box.add_widget(btn_confirm)
        content.add_widget(btn_box)

        popup.open()

    def do_delete_record(self, popup, record_id):
        """Executar a operação de eliminação."""
        try:
            api.delete_consumo(record_id)
            popup.dismiss()
            self.load_data()  # Atualizar dashboard
        except Exception as e:
            print(f"[ERROR] do_delete_record: {e}")


class AddConsumptionScreen(Screen):
    error = StringProperty("")
    success = StringProperty("")

    def on_pre_enter(self):
        """Repor campos para valores por defeito ao entrar no ecrã."""
        self.ids.quantidade.text = "250"
        self.ids.tipo.text = "Água"
        self.error = ""
        self.success = ""

    def save(self):
        self.error = ""
        self.success = ""
        try:
            quantidade = int((self.ids.quantidade.text or "0").strip())
            tipo = (self.ids.tipo.text or "Água").strip()
            api.adicionar_consumo(state.user["userId"], quantidade, tipo)
            self.success = "Consumo registado."
            # refrescar dashboard
            self.manager.get_screen("dashboard").load_data()
        except Exception as e:
            self.error = msg_from_exc(e)

    def quick_add(self, quantidade_ml):
        """Adicionar rapidamente uma quantidade predefinida de consumo."""
        self.error = ""
        self.success = ""
        try:
            tipo = (self.ids.tipo.text or "Água").strip()
            api.adicionar_consumo(state.user["userId"], quantidade_ml, tipo)
            self.success = f"{quantidade_ml} ml registado!"
            # Atualizar o campo de input para mostrar o que foi adicionado
            self.ids.quantidade.text = str(quantidade_ml)
            # Atualizar dashboard
            self.manager.get_screen("dashboard").load_data()
        except Exception as e:
            self.error = msg_from_exc(e)


class SettingsScreen(Screen):
    current_url = StringProperty("")
    current_goal = StringProperty("")
    current_nome = StringProperty("")
    current_idade = StringProperty("")
    current_peso = StringProperty("")
    error = StringProperty("")
    success = StringProperty("")
    connection_status = StringProperty("")

    def on_pre_enter(self):
        """Carregar configurações atuais ao entrar no ecrã de definições."""
        self.current_url = api.get_api_url()
        self.current_goal = str(api.get_daily_goal())
        self.error = ""
        self.success = ""
        self.connection_status = ""

        # Carregar dados do perfil da API
        if state.user:
            try:
                profile = api.get_perfil(state.user["userId"])
                self.current_nome = profile.get("nome") or ""
                self.current_idade = str(profile.get("idade") or "")
                self.current_peso = str(profile.get("peso") or "")
                if profile.get("meta_diaria"):
                    # Converter de litros para ml
                    self.current_goal = str(int(profile.get("meta_diaria") * 1000))
            except Exception as e:
                print(f"[DEBUG] SettingsScreen: Erro ao carregar perfil: {e}")
                self.current_nome = state.user.get("nome", "")

    def test_connection(self):
        """Testar se o URL da API está acessível."""
        self.error = ""
        self.success = ""
        self.connection_status = "A testar..."
        url = self.ids.api_url_input.text.strip()

        if not url:
            self.error = "URL nao pode estar vazia"
            self.connection_status = ""
            return

        try:
            import requests
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                self.success = "Conexao bem-sucedida!"
                self.connection_status = "Conectado"
            else:
                self.error = f"Servidor respondeu com codigo {response.status_code}"
                self.connection_status = "Erro"
        except Exception as e:
            self.error = f"Falha na conexao: {str(e)}"
            self.connection_status = "Erro"

    def save_settings(self):
        """Guardar definições e perfil no ficheiro de configuração e na API."""
        self.error = ""
        self.success = ""

        url = self.ids.api_url_input.text.strip()
        goal_text = self.ids.daily_goal_input.text.strip()
        nome = self.ids.nome_input.text.strip()
        idade_text = self.ids.idade_input.text.strip()
        peso_text = self.ids.peso_input.text.strip()

        if not url:
            self.error = "URL nao pode estar vazia"
            return

        if not nome:
            self.error = "Nome nao pode estar vazio"
            return

        # Validar objetivo diário
        try:
            daily_goal = int(goal_text) if goal_text else 2000
            if daily_goal <= 0:
                self.error = "Objetivo deve ser um valor positivo"
                return
        except ValueError:
            self.error = "Objetivo deve ser um numero"
            return

        # Processar idade e peso
        idade = int(idade_text) if idade_text else None
        peso = float(peso_text) if peso_text else None

        # Garantir que o URL começa com http:// ou https://
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "http://" + url

        # Remover barra final se existir
        url = url.rstrip("/")

        # Guardar configuração local
        if api.save_config(api_url=url, daily_goal_ml=daily_goal):
            self.current_url = url
            self.current_goal = str(daily_goal)

        # Guardar perfil na API
        if state.user:
            try:
                meta_diaria_litros = daily_goal / 1000.0
                api.update_perfil(state.user["userId"], nome, idade, peso, meta_diaria_litros)
                state.user["nome"] = nome
                self.current_nome = nome
                self.current_idade = str(idade) if idade else ""
                self.current_peso = str(peso) if peso else ""
                self.success = "Configuracoes guardadas!"
            except Exception as e:
                print(f"[DEBUG] save_settings: Erro ao guardar perfil: {e}")
                self.error = f"Erro ao guardar perfil: {msg_from_exc(e)}"
                return

        # Recarregar dashboard
        try:
            dashboard = self.manager.get_screen("dashboard")
            dashboard.welcome = f"Ola, {nome}"
            dashboard.load_data()
        except Exception as e:
            print(f"[DEBUG] save_settings: Erro ao recarregar dashboard: {e}")


class GraficoScreen(Screen):
    """Ecrã de gráfico de barras dos últimos 7 dias."""

    chart_data = ListProperty([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    max_value = NumericProperty(2.0)
    day_labels = ListProperty(["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"])

    def on_pre_enter(self):
        """Carrega dados quando entra no ecrã."""
        self.load_chart_data()

    def load_chart_data(self):
        """Carrega dados da API e processa para o gráfico."""
        try:
            data = api.listar_consumo(state.user["userId"])
            self.chart_data = processa_dados_ultimos_7_dias(data)

            # Usar escala fixa baseada no objetivo diario
            # Assim as barras crescem em vez da escala mudar
            daily_goal_liters = api.get_daily_goal() / 1000.0
            max_data = max(self.chart_data) if self.chart_data else 0.0

            # Escala fixa: objetivo * 1.2, ou se algum valor ultrapassar, usar esse + 20%
            self.max_value = round(max(daily_goal_liters * 1.2, max_data * 1.2), 1)
            if self.max_value == 0:
                self.max_value = 2.0

            self.update_day_labels()
            print(f"[DEBUG] GraficoScreen: data={self.chart_data}, max={self.max_value}, goal={daily_goal_liters}L")
        except Exception as e:
            print(f"[DEBUG] GraficoScreen ERROR: {e}")
            self.chart_data = [0.0] * 7
            self.max_value = 2.0

    def update_day_labels(self):
        """Atualiza labels dos dias baseado na data atual."""
        from datetime import datetime, timedelta
        dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        today = datetime.utcnow().date()
        labels = []

        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            labels.append(dias[date.weekday()])

        self.day_labels = labels


class Router(ScreenManager):
    pass


# =========================
# Helpers
# =========================
def calcula_total_hoje_litros(history):
    """Calcula total de água hoje (exclui Café)."""
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    total_ml = sum((r.get("quantidade_ml") or 0)
                   for r in history
                   if str(r.get("data_registo", "")).startswith(today)
                   and str(r.get("tipo_bebida", "")).lower() != "café")
    return round(total_ml / 1000.0, 1)


def conta_cafes_hoje(history):
    """Conta quantos cafés foram bebidos hoje."""
    from datetime import datetime
    today = datetime.utcnow().date().isoformat()
    cafes = sum(1 for r in history
                if str(r.get("data_registo", "")).startswith(today)
                and str(r.get("tipo_bebida", "")).lower() == "café")
    return cafes


def calcula_media_semanal(history):
    """Calcula a média de consumo de água dos últimos 7 dias (exclui Café)."""
    from datetime import datetime, timedelta

    # Agrupar por data (excluir café)
    daily_data = {}
    for r in history:
        if str(r.get("tipo_bebida", "")).lower() == "café":
            continue  # Ignorar café
        date_str = str(r.get("data_registo", ""))[:10]  # YYYY-MM-DD
        if date_str:
            if date_str not in daily_data:
                daily_data[date_str] = 0
            daily_data[date_str] += r.get("quantidade_ml") or 0

    # Últimos 7 dias
    today = datetime.utcnow().date()
    total_ml = 0
    days_with_data = 0

    for i in range(7):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        if date_str in daily_data:
            total_ml += daily_data[date_str]
            days_with_data += 1

    if days_with_data == 0:
        return 0.0

    return round((total_ml / days_with_data) / 1000.0, 1)  # Litros


def calcula_streak(history):
    """Calcula o número de dias consecutivos com consumo de água (exclui Café)."""
    from datetime import datetime, timedelta

    # Agrupar por data (excluir café)
    daily_data = {}
    for r in history:
        if str(r.get("tipo_bebida", "")).lower() == "café":
            continue  # Ignorar café
        date_str = str(r.get("data_registo", ""))[:10]  # YYYY-MM-DD
        if date_str:
            if date_str not in daily_data:
                daily_data[date_str] = 0
            daily_data[date_str] += r.get("quantidade_ml") or 0

    # Verificar streak
    today = datetime.utcnow().date()
    check_date = today

    # Se hoje não tem consumo, começar de ontem
    if today.isoformat() not in daily_data:
        check_date = today - timedelta(days=1)

    streak = 0
    while check_date.isoformat() in daily_data and daily_data[check_date.isoformat()] > 0:
        streak += 1
        check_date -= timedelta(days=1)
        # Limite de segurança
        if streak > 365:
            break

    return streak


def processa_dados_ultimos_7_dias(history):
    """
    Processa dados dos últimos 7 dias para o gráfico.
    Retorna lista de 7 valores (litros) do mais antigo ao mais recente.
    Exclui Café.
    """
    from datetime import datetime, timedelta

    # Agrupar por data (excluir café)
    daily_data = {}
    for r in history:
        if str(r.get("tipo_bebida", "")).lower() == "café":
            continue
        date_str = str(r.get("data_registo", ""))[:10]
        if date_str:
            if date_str not in daily_data:
                daily_data[date_str] = 0
            daily_data[date_str] += r.get("quantidade_ml") or 0

    # Últimos 7 dias (6 dias atrás até hoje)
    today = datetime.utcnow().date()
    result = []

    for i in range(6, -1, -1):
        date = today - timedelta(days=i)
        date_str = date.isoformat()
        ml = daily_data.get(date_str, 0)
        liters = round(ml / 1000.0, 2)
        result.append(liters)

    return result


def msg_from_exc(e: Exception) -> str:
    try:
        import requests
        if isinstance(e, requests.HTTPError):
            resp = e.response
            try:
                j = resp.json()
                return j.get("message") or f"HTTP {resp.status_code}"
            except Exception:
                return f"HTTP {resp.status_code}"
        return str(e)
    except Exception:
        return "Erro de rede"


# =========================
# App
# =========================
class SmartBottleApp(App):
    def build(self):
        self.title = "SmartBottle"
        # Carrega e DEVOLVE a instância raiz criada no ficheiro KV
        return Builder.load_file("ui.kv")


if __name__ == "__main__":
    SmartBottleApp().run()
