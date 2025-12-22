import requests
import json
import os

# Valores por defeito
DEFAULT_API_URL = "http://localhost:5000"
DEFAULT_DAILY_GOAL_ML = 2000  # 2 litros por dia
API_KEY = "SmartBottle_API_Key_2025_SecureAccess_9f8e7d6c5b4a3"

def get_config_path():
    """Obter o caminho do ficheiro de configuração na diretoria de dados da app."""
    # Verificar se está a correr no Android
    if 'ANDROID_PRIVATE' in os.environ:
        # Usar armazenamento privado do Android
        config_dir = os.environ['ANDROID_PRIVATE']
    else:
        # Usar diretoria home do utilizador para guardar configuração (desktop)
        home = os.path.expanduser("~")
        config_dir = os.path.join(home, ".smartbottle")
        os.makedirs(config_dir, exist_ok=True)

    return os.path.join(config_dir, "config.json")

def load_config():
    """Carregar configuração completa do ficheiro, ou retornar valores por defeito."""
    config_path = get_config_path()
    default_config = {
        "api_url": DEFAULT_API_URL,
        "daily_goal_ml": DEFAULT_DAILY_GOAL_ML
    }
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                # Juntar com valores por defeito para chaves em falta
                return {**default_config, **config}
    except Exception:
        pass
    return default_config

def save_config(api_url: str = None, daily_goal_ml: int = None):
    """Guardar configuração no ficheiro. Passar None para manter o valor existente."""
    config_path = get_config_path()
    try:
        # Carregar configuração existente
        current_config = load_config()

        # Atualizar apenas os valores fornecidos
        if api_url is not None:
            current_config["api_url"] = api_url
        if daily_goal_ml is not None:
            current_config["daily_goal_ml"] = daily_goal_ml

        # Guardar configuração atualizada
        with open(config_path, 'w') as f:
            json.dump(current_config, f)
        return True
    except Exception as e:
        print(f"Erro ao guardar configuração: {e}")
        return False

def get_api_url():
    """Obter o URL da API atual da configuração."""
    return load_config()["api_url"]

def get_daily_goal():
    """Obter o objetivo diário em ml da configuração."""
    return load_config()["daily_goal_ml"]

def login(email: str, password: str):
    url = f"{get_api_url()}/api/login"
    r = requests.post(url, json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()

def registo(nome: str, email: str, password: str):
    url = f"{get_api_url()}/api/registo"
    r = requests.post(url, json={"nome": nome, "email": email, "password": password}, timeout=10)
    r.raise_for_status()
    return r.json()

def listar_consumo(user_id: int):
    url = f"{get_api_url()}/api/consumo/{user_id}"
    headers = {"X-API-Key": API_KEY}
    r = requests.get(url, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def adicionar_consumo(user_id: int, quantidade_ml: int, tipo_bebida: str):
    url = f"{get_api_url()}/api/consumo"
    headers = {"X-API-Key": API_KEY}
    payload = {"userId": user_id, "quantidadeMl": quantidade_ml, "tipoBebida": tipo_bebida}
    r = requests.post(url, json=payload, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def get_perfil(user_id: int):
    """Obter perfil do utilizador da API."""
    url = f"{get_api_url()}/api/perfil/{user_id}"
    headers = {"X-API-Key": API_KEY}
    r = requests.get(url, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def update_perfil(user_id: int, nome: str, idade: int = None, peso: float = None, meta_diaria: float = None):
    """Atualizar perfil do utilizador via API."""
    url = f"{get_api_url()}/api/perfil/{user_id}"
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
    payload = {
        "nome": nome,
        "idade": idade,
        "peso": peso,
        "meta_diaria": meta_diaria
    }
    r = requests.put(url, json=payload, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def delete_consumo(consumo_id: int):
    """Eliminar um registo de consumo pelo ID."""
    url = f"{get_api_url()}/api/consumo/{consumo_id}"
    headers = {"X-API-Key": API_KEY}
    r = requests.delete(url, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()

def update_consumo(consumo_id: int, quantidade_ml: int, tipo_bebida: str):
    """Atualizar um registo de consumo pelo ID."""
    url = f"{get_api_url()}/api/consumo/{consumo_id}"
    headers = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
    payload = {
        "quantidadeMl": quantidade_ml,
        "tipoBebida": tipo_bebida
    }
    r = requests.put(url, json=payload, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()
