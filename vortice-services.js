/* VORTICE SERVICES v3.0 - OneDrive/Outlook Corrigido, Analytics de Visitantes, Automações & Investigador */
window.VorticeServices = (function () {
  // 1. MICROSOFT GRAPH (ONEDRIVE / OUTLOOK) - FLUXO CORRIGIDO
  function getRedirectUri() {
    return window.location.origin + "/Votice-Site/admin/index.html";
  }

  function getMsAuthUrl() {
    const s = VorticeCore.getSecrets();
    if (!s.msClientId) {
      throw new Error("Cole primeiro o MS_CLIENT_ID na aba 7 e clique em 'Salvar Todas as Chaves'.");
    }
    const tenant = (s.msTenantId && s.msTenantId.trim()) ? s.msTenantId.trim() : "common";
    const redirectUri = getRedirectUri();
    const scopes = encodeURIComponent("openid profile email User.Read Files.ReadWrite Calendars.ReadWrite Mail.Send");
    const state = "vortice_" + Date.now();
    sessionStorage.setItem("vortice_ms_state", state);

    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(s.msClientId.trim())}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&prompt=select_account`;
  }

  function captureMsTokenFromHash() {
    const hash = window.location.hash || "";
    if (hash.includes("error=")) {
      const p = new URLSearchParams(hash.substring(1));
      const errDesc = decodeURIComponent(p.get("error_description") || p.get("error") || "Erro na autenticação Microsoft");
      history.replaceState(null, "", window.location.pathname);
      return { error: errDesc };
    }
    if (hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get("access_token");
      const expiresIn = Number(params.get("expires_in") || 3600);
      if (token) {
        VorticeCore.saveSecrets({
          msAccessToken: token,
          msTokenExpiresAt: Date.now() + expiresIn * 1000
        });
        history.replaceState(null, "", window.location.pathname);
        return { token };
      }
    }
    const s = VorticeCore.getSecrets();
    if (s.msAccessToken && (!s.msTokenExpiresAt || Date.now() < s.msTokenExpiresAt)) {
      return { token: s.msAccessToken };
    }
    return null;
  }

  async function graphRequest(endpoint, method = "GET", body = null, contentType = "application/json") {
    const s = VorticeCore.getSecrets();
    const token = s.msAccessToken;
    if (!token) throw new Error("OneDrive desconectado. Vá na aba 7 e clique em 'Conectar / Autorizar OneDrive & Outlook'.");

    const headers = { Authorization: `Bearer ${token}` };
    if (body && contentType) headers["Content-Type"] = contentType;

    const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method,
      headers,
      body: body ? (contentType === "application/json" ? JSON.stringify(body) : body) : undefined
    });

    if (res.status === 401) {
      VorticeCore.saveSecrets({ msAccessToken: "" });
      throw new Error("Sessão Microsoft expirada. Clique novamente em 'Conectar / Autorizar OneDrive & Outlook'.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || `Erro Microsoft Graph (${res.status})`);
    }
    if (res.status === 204) return true;
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  }

  async function ensureOneDriveFolder(folderPath) {
    const parts = folderPath.split("/").filter(Boolean);
    let currentPath = "";
    for (const part of parts) {
      const endpoint = currentPath
        ? `/me/drive/root:/${encodeURIComponent(currentPath)}:/children`
        : `/me/drive/root/children`;
      await graphRequest(endpoint, "POST", {
        name: part,
        folder: {},
        "@microsoft.graph.conflictBehavior": "ignore"
      }).catch(() => {});
      currentPath = currentPath ? `${currentPath}/${part}` : part;
    }
    return currentPath;
  }

  async function uploadToOneDrive(folderPath, fileName, fileBlobOrText, contentType = "application/octet-stream") {
    await ensureOneDriveFolder(folderPath);
    const fullPath = `${folderPath}/${fileName}`;
    return await graphRequest(
      `/me/drive/root:/${encodeURIComponent(fullPath)}:/content`,
      "PUT",
      fileBlobOrText,
      contentType
    );
  }

  async function sendOutlookMail(toEmail, subject, htmlBody) {
    if (!toEmail) return;
    return await graphRequest("/me/sendMail", "POST", {
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: toEmail } }]
      },
      saveToSentItems: true
    });
  }

  // 2. NOTIFICAÇÕES & AUTOMAÇÕES CONFIGURÁVEIS
  async function sendNotification(eventoKey, titulo, mensagem, dadosExtras = {}) {
    try {
      const db = VorticeCore.getDB();
      const cfg = db.notificacoes || {};
      const ev = (cfg.eventos && cfg.eventos[eventoKey]) || { email: true, whatsapp: false };

      if (ev.whatsapp && cfg.whatsappUrl && cfg.whatsappNumero) {
        fetch(cfg.whatsappUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: cfg.whatsappToken || "",
            Authorization: cfg.whatsappToken ? `Bearer ${cfg.whatsappToken}` : ""
          },
          body: JSON.stringify({ number: cfg.whatsappNumero, text: `*${titulo}*\n\n${mensagem}` })
        }).catch(() => {});
      }

      if (ev.email && cfg.emailAlerta) {
        await sendOutlookMail(cfg.emailAlerta, titulo, `<pre style="font-family:sans-serif">${mensagem}</pre>`).catch(() => {});
      }

      (cfg.webhooksExtras || []).forEach((wh) => {
        if (wh.ativo && wh.url) {
          fetch(wh.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ evento: eventoKey, titulo, mensagem, ...dadosExtras })
          }).catch(() => {});
        }
      });

      return { ok: true };
    } catch (e) {
      return { ok: false, erro: e.message };
    }
  }

  // 3. RASTREADOR DE VISITANTES -> PLANILHA ONEDRIVE + E-MAIL AUTOMÁTICO (ABANDONO / DESCONTO)
  async function registrarVisita(infoExtra = {}) {
    try {
      const db = VorticeCore.getDB();
      db.visitantes = db.visitantes || [];
      const leadSalvo = JSON.parse(localStorage.getItem("vortice_visitor_profile") || "{}");
      const perfil = {
        nome: infoExtra.nome || leadSalvo.nome || "Visitante Anônimo",
        email: infoExtra.email || leadSalvo.email || "",
        whatsapp: infoExtra.whatsapp || leadSalvo.whatsapp || ""
      };
      if (infoExtra.nome || infoExtra.email || infoExtra.whatsapp) {
        localStorage.setItem("vortice_visitor_profile", JSON.stringify(perfil));
      }

      const registro = {
        dataHora: new Date().toLocaleString("pt-BR"),
        nome: perfil.nome,
        email: perfil.email || "Não informado",
        whatsapp: perfil.whatsapp || "Não informado",
        pagina: infoExtra.pagina || location.pathname,
        acao: infoExtra.acao || "Visualizou página",
        itemInteresse: infoExtra.item || "-",
        idioma: navigator.language || "pt-BR",
        origem: document.referrer || "Acesso Direto"
      };

      db.visitantes.unshift(registro);
      if (db.visitantes.length > 1000) db.visitantes.pop();
      VorticeCore.saveDB(db);

      // Atualiza planilha CSV no OneDrive automaticamente (se conectado)
      if (VorticeCore.getSecrets().msAccessToken) {
        const cabecalho = "Data/Hora;Nome;E-mail;WhatsApp;Página;Ação;Item de Interesse;Idioma;Origem\n";
        const linhas = db.visitantes.map(v =>
          `"${v.dataHora}";"${v.nome}";"${v.email}";"${v.whatsapp}";"${v.pagina}";"${v.acao}";"${v.itemInteresse}";"${v.idioma}";"${v.origem}"`
        ).join("\n");
        uploadToOneDrive("Vórtice/Analytics", "Visitantes_e_Leads.csv", "\uFEFF" + cabecalho + linhas, "text/csv;charset=utf-8").catch(() => {});
      }

      // Dispara automação de e-mail se visitante informou e-mail e caiu em regra ativa
      if (perfil.email && db.automacoesEmail) {
        for (const auto of db.automacoesEmail) {
          if (!auto.ativo) continue;
          const gatilhoBateu =
            (auto.gatilho === "visita_site" && registro.acao === "Visualizou página") ||
            (auto.gatilho === "abandono_curso" && registro.acao === "Quase comprou curso") ||
            (auto.gatilho === "interesse_vaga" && registro.acao === "Visualizou vagas");

          const chaveEnvio = `auto_sent_${auto.id}_${perfil.email}`;
          if (gatilhoBateu && !sessionStorage.getItem(chaveEnvio)) {
            sessionStorage.setItem(chaveEnvio, "1");
            const corpo = (auto.mensagem || "")
              .replace(/\{\{NOME\}\}/g, perfil.nome)
              .replace(/\{\{ITEM\}\}/g, registro.itemInteresse)
              .replace(/\{\{CUPOM\}\}/g, auto.cupom || "");
            await sendOutlookMail(perfil.email, auto.assunto, corpo.replace(/\n/g, "<br>")).catch(() => {});
          }
        }
      }
    } catch (e) {}
  }

  // 4. MERCADO PAGO CHECKOUT (API)
  async function criarCheckoutMercadoPago(titulo, valor, emailPagador) {
    const s = VorticeCore.getSecrets();
    if (!s.mpAccessToken) {
      throw new Error("Configure o Access Token do Mercado Pago no Painel Admin (Aba 6).");
    }
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.mpAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: [{ title: titulo, quantity: 1, currency_id: "BRL", unit_price: Number(valor) }],
        payer: emailPagador ? { email: emailPagador } : undefined,
        back_urls: {
          success: window.location.origin + "/Votice-Site/cursos/?status=aprovado",
          failure: window.location.origin + "/Votice-Site/cursos/?status=falha",
          pending: window.location.origin + "/Votice-Site/cursos/?status=pendente"
        },
        auto_return: "approved"
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Erro ao gerar link de pagamento no Mercado Pago.");
    }
    const data = await res.json();
    return s.mpModo === "teste" ? data.sandbox_init_point : data.init_point;
  }

  // 5. INVESTIGADOR 10.0 (IBGE + AZURE MAPS)
  async function buscarCidadesIBGE(filtros) {
    if (filtros.modo === "cidade_unica") {
      return filtros.cidadeUnica ? [{ nome: filtros.cidadeUnica.trim(), populacao: "Verificado" }] : [];
    }
    if (filtros.modo === "varias_cidades") {
      return (filtros.listaCidades || "").split("\n").map(c => c.trim()).filter(Boolean).map(nome => ({ nome, populacao: "Verificado" }));
    }
    let url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios";
    if (filtros.modo === "estado" && filtros.estado) {
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${filtros.estado}/municipios`;
    } else if (filtros.modo === "macrorregiao" && filtros.macrorregiao) {
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/regioes/${filtros.macrorregiao}/municipios`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao consultar lista oficial de cidades do IBGE.");
    const municipios = await res.json();
    return municipios.map(m => ({
      id: m.id,
      nome: `${m.nome} - ${m.microrregiao?.mesorregiao?.UF?.sigla || ""}`,
      uf: m.microrregiao?.mesorregiao?.UF?.sigla || ""
    }));
  }

  async function buscarEmpresasAzureMaps(termo, cidade, limite = 20) {
    const key = VorticeCore.getSecrets().azureMapsKey;
    if (!key) throw new Error("Configure a Chave do Azure Maps na Aba 7.");
    const query = encodeURIComponent(`${termo} ${cidade} Brasil`);
    const url = `https://atlas.microsoft.com/search/poi/json?api-version=1.0&subscription-key=${key}&query=${query}&countrySet=BR&limit=${limite}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao consultar Azure Maps.");
    const data = await res.json();
    return (data.results || []).map(item => {
      const nome = item.poi?.name || "NÃO ENCONTRADO";
      const telRaw = item.poi?.phone || "";
      const linkProva = item.poi?.url || `https://www.bing.com/maps?q=${encodeURIComponent(nome + " " + cidade)}`;
      return {
        nome,
        telefone: telRaw ? `${telRaw} (Fonte: Azure Maps - ${linkProva})` : "NÃO ENCONTRADO",
        endereco: item.address?.freeformAddress || "NÃO ENCONTRADO",
        linkMapa: linkProva
      };
    });
  }

  return {
    getRedirectUri,
    getMsAuthUrl,
    captureMsTokenFromHash,
    graphRequest,
    ensureOneDriveFolder,
    uploadToOneDrive,
    sendOutlookMail,
    sendNotification,
    registrarVisita,
    criarCheckoutMercadoPago,
    buscarCidadesIBGE,
    buscarEmpresasAzureMaps
  };
})();
