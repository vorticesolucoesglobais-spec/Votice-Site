/* VORTICE SERVICES v4.0 - Microsoft Consumers/OAuth Corrigido, Mercado Pago Pix/Débito, OneDrive & Investigador Massivo */
window.VorticeServices = (function () {
  const OUTLOOK_OFICIAL = "vorticesolucoesglobais@outlook.com";

  // 1. MICROSOFT GRAPH (ONEDRIVE & OUTLOOK) - CORRIGIDO PARA @OUTLOOK.COM (CONSUMERS)
  function getRedirectUri() {
    return window.location.origin + "/Votice-Site/admin/index.html";
  }

  function resolverTenantMicrosoft(tenantRaw) {
    const t = (tenantRaw || "").trim();
    // GUID válido tem exatamente 36 caracteres; para @outlook.com usa-se 'consumers'
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!t || t === "common" || t === "consumers" || !guidRegex.test(t)) {
      return "consumers";
    }
    return t;
  }

  function getMsAuthUrl() {
    const s = VorticeCore.getSecrets();
    if (!s.msClientId || !s.msClientId.trim()) {
      throw new Error("Cole primeiro o Microsoft Client ID na Aba 7 e clique em 'Salvar Todas as Chaves'.");
    }
    const tenant = resolverTenantMicrosoft(s.msTenantId);
    const redirectUri = getRedirectUri();
    const scopes = encodeURIComponent("openid profile email User.Read Files.ReadWrite Calendars.ReadWrite Mail.Send");
    const state = "vortice_" + Date.now();
    sessionStorage.setItem("vortice_ms_state", state);

    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(s.msClientId.trim())}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&login_hint=${encodeURIComponent(OUTLOOK_OFICIAL)}&prompt=select_account`;
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
    if (!token) throw new Error("OneDrive desconectado. Vá na Aba 7 e clique em '2º Conectar / Autorizar OneDrive & Outlook'.");

    const headers = { Authorization: `Bearer ${token}` };
    if (body && contentType) headers["Content-Type"] = contentType;

    const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method,
      headers,
      body: body ? (contentType === "application/json" ? JSON.stringify(body) : body) : undefined
    });

    if (res.status === 401) {
      VorticeCore.saveSecrets({ msAccessToken: "" });
      throw new Error("Sessão Microsoft expirada. Clique novamente em '2º Conectar / Autorizar OneDrive & Outlook'.");
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

  async function inicializarEstruturaOneDrive() {
    await ensureOneDriveFolder("Vórtice");
    await ensureOneDriveFolder("Vórtice/Clientes");
    await ensureOneDriveFolder("Vórtice/Analytics");
    await ensureOneDriveFolder("Vórtice/Contratações");
    await ensureOneDriveFolder("Vórtice/Investigador");
    return true;
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
    const destino = (toEmail || OUTLOOK_OFICIAL).trim();
    return await graphRequest("/me/sendMail", "POST", {
      message: {
        subject,
        body: { contentType: "HTML", content: htmlBody },
        toRecipients: [{ emailAddress: { address: destino } }]
      },
      saveToSentItems: true
    });
  }

  // 2. NOTIFICAÇÕES & AUTOMAÇÕES CONFIGURÁVEIS
  async function sendNotification(eventoKey, titulo, mensagem, dadosExtras = {}) {
    try {
      const db = VorticeCore.getDB();
      const cfg = db.notificacoes || {};
      const emailDestino = (cfg.emailAlerta && cfg.emailAlerta.trim()) ? cfg.emailAlerta.trim() : OUTLOOK_OFICIAL;
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

      if (ev.email !== false && emailDestino) {
        await sendOutlookMail(emailDestino, titulo, `<div style="font-family:sans-serif;line-height:1.6"><h3>${titulo}</h3><pre style="white-space:pre-wrap;font-family:sans-serif">${mensagem}</pre></div>`);
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

  // 3. RASTREADOR DE VISITANTES -> PLANILHA ONEDRIVE + E-MAIL AUTOMÁTICO
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
      if (db.visitantes.length > 1500) db.visitantes.pop();
      VorticeCore.saveDB(db);

      if (VorticeCore.getSecrets().msAccessToken) {
        const cabecalho = "Data/Hora;Nome;E-mail;WhatsApp;Página;Ação;Item de Interesse;Idioma;Origem\n";
        const linhas = db.visitantes.map(v =>
          `"${v.dataHora}";"${v.nome}";"${v.email}";"${v.whatsapp}";"${v.pagina}";"${v.acao}";"${v.itemInteresse}";"${v.idioma}";"${v.origem}"`
        ).join("\n");
        uploadToOneDrive("Vórtice/Analytics", "Visitantes_e_Leads.csv", "\uFEFF" + cabecalho + linhas, "text/csv;charset=utf-8").catch(() => {});
      }

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

  // 4. MERCADO PAGO CHECKOUT PRO (PIX + DÉBITO + CRÉDITO + BOLETO HABILITADOS)
  async function criarCheckoutMercadoPago(titulo, valor, emailPagador, nomePagador) {
    const s = VorticeCore.getSecrets();
    if (!s.mpAccessToken || !s.mpAccessToken.trim()) {
      throw new Error("Configure o Access Token do Mercado Pago no Painel Admin (Aba 6).");
    }
    const payload = {
      items: [
        {
          id: "VORTICE_" + Date.now(),
          title: titulo,
          description: "Vórtice Soluções Globais — " + titulo,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(Number(valor).toFixed(2))
        }
      ],
      payer: {
        name: nomePagador || "Cliente Vórtice",
        email: emailPagador || OUTLOOK_OFICIAL
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      statement_descriptor: "VORTICE GLOBAL",
      back_urls: {
        success: window.location.origin + "/Votice-Site/cursos/?status=aprovado",
        failure: window.location.origin + "/Votice-Site/cursos/?status=falha",
        pending: window.location.origin + "/Votice-Site/cursos/?status=pendente"
      },
      auto_return: "approved"
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.mpAccessToken.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Erro ao gerar checkout no Mercado Pago. Verifique se o Access Token é de Produção e se há chave Pix cadastrada na conta.");
    }
    const data = await res.json();
    return s.mpModo === "teste" ? data.sandbox_init_point : data.init_point;
  }

  // 5. INVESTIGADOR 10.0 — MOTOR MASSIVO DE INTELIGÊNCIA B2B (IBGE + AZURE MAPS + OPENSTREETMAP FALLBACK)
  const MAPA_MACRORREGIOES = {
    norte: 1, nordeste: 2, sudeste: 3, sul: 4, "centro-oeste": 5, centrooeste: 5
  };

  async function buscarCidadesIBGE(filtros) {
    const param = (filtros.param || "").trim();
    if (filtros.modo === "cidade_unica") {
      if (!param) throw new Error("Digite o nome da cidade (ex: Porto Feliz - SP).");
      return [{ nome: param, uf: (param.split("-")[1] || "BR").trim().toUpperCase() }];
    }
    if (filtros.modo === "varias_cidades") {
      const lista = param.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
      if (!lista.length) throw new Error("Digite pelo menos uma cidade.");
      return lista.map(nome => ({ nome, uf: (nome.split("-")[1] || "BR").trim().toUpperCase() }));
    }

    let url = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome";
    if (filtros.modo === "estado") {
      const uf = param.toUpperCase().slice(0, 2);
      if (!uf) throw new Error("Informe a sigla do Estado (ex: SP, RJ, MG, PR).");
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`;
    } else if (filtros.modo === "macrorregiao") {
      const idReg = MAPA_MACRORREGIOES[param.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] || 3;
      url = `https://servicodados.ibge.gov.br/api/v1/localidades/regioes/${idReg}/municipios?orderBy=nome`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao consultar lista oficial de municípios no IBGE.");
    const municipios = await res.json();
    return municipios.map(m => {
      const uf = m.microrregiao?.mesorregiao?.UF?.sigla || "";
      return { id: m.id, nome: uf ? `${m.nome} - ${uf}` : m.nome, uf };
    });
  }

  function calcularAderenciaVortice(nome, categoria, siteUrl, tel) {
    const texto = `${nome} ${categoria}`.toLowerCase();
    const oportunidades = [];
    if (/ind[uú]stria|metal[uú]rgica|f[aá]brica|usinagem|pl[aá]stico|embalag/i.test(texto)) {
      oportunidades.push("Gestão Empresarial & ERP", "Uniformes Industriais", "Usinagem CNC / Corte a Laser", "Suporte TI & Infra");
    } else if (/cl[ií]nica|hospital|sa[uú]de|odont|laborat/i.test(texto)) {
      oportunidades.push("Uniformes / Jalecos Bordados", "Assessoria Administrativa", "Gestão de Redes Sociais", "Segurança LGPD & TI");
    } else if (/com[eé]rcio|loja|mercado|supermercado|restaurante|padaria|confeitaria/i.test(texto)) {
      oportunidades.push("Gestão de Redes Sociais", "Uniformes Personalizados", "BPO Financeiro & Fluxo de Caixa");
    } else if (/igreja|minist[eé]rio|associa[cç][aã]o|instituto|escola|col[eé]gio/i.test(texto)) {
      oportunidades.push("Uniformes & Brindes", "Letras Caixa / Troféus CNC", "Assessoria Administrativa", "Gestão de Mídias");
    } else {
      oportunidades.push("Assessoria Administrativa", "Suporte Técnico de TI", "Gestão de Redes Sociais");
    }

    let score = 4; // Base por existir em fonte pública oficial
    const provas = [];
    if (tel && tel !== "NÃO ENCONTRADO") { score += 3; provas.push("Telefone comercial verificado"); }
    if (siteUrl && /^https?:\/\//i.test(siteUrl)) { score += 3; provas.push("Website oficial ativo"); }
    else { oportunidades.push("Criação / Gestão Digital"); }

    const classificacao = score >= 9 ? "OURO" : score >= 7 ? "PRATA" : "BRONZE";
    return { score, classificacao, oportunidades, provas };
  }

  async function investigarCidadeDetalhado(termo, cidadeObj, limite = 25) {
    const key = (VorticeCore.getSecrets().azureMapsKey || "").trim();
    const resultadosBrutos = [];
    const vistos = new Set();

    // 1. Consulta Principal: Azure Maps POI Search (múltiplas variações do termo)
    if (key) {
      const consultas = [
        `${termo} ${cidadeObj.nome} Brasil`,
        `${termo} em ${cidadeObj.nome}`
      ];
      for (const qText of consultas) {
        if (resultadosBrutos.length >= limite) break;
        const url = `https://atlas.microsoft.com/search/poi/json?api-version=1.0&subscription-key=${encodeURIComponent(key)}&query=${encodeURIComponent(qText)}&countrySet=BR&limit=${Math.min(limite, 50)}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            for (const item of (data.results || [])) {
              const nome = (item.poi?.name || "").trim();
              if (!nome || vistos.has(nome.toLowerCase())) continue;
              vistos.add(nome.toLowerCase());
              const tel = (item.poi?.phone || "").trim();
              const site = (item.poi?.url || "").trim();
              const end = item.address?.freeformAddress || cidadeObj.nome;
              const cat = (item.poi?.categories || []).join(", ") || termo;
              const lat = item.position?.lat || "";
              const lon = item.position?.lon || "";
              const linkMapa = site && /^https?:\/\//i.test(site)
                ? site
                : `https://www.bing.com/maps?q=${encodeURIComponent(nome + " " + end)}`;

              const analise = calcularAderenciaVortice(nome, cat, site, tel);
              resultadosBrutos.push({
                nome,
                cidade: cidadeObj.nome,
                telefone: tel || "NÃO ENCONTRADO",
                website: site || "NÃO ENCONTRADO",
                endereco: end,
                categoria: cat,
                coordenadas: lat && lon ? `${lat}, ${lon}` : "-",
                linkProva: linkMapa,
                fonte: "Azure Maps / Bing Places",
                score: analise.score,
                classificacao: analise.classificacao,
                modulosRecomendados: analise.oportunidades,
                statusRevisao: "Aguardando Revisão"
              });
            }
          }
        } catch (e) {}
      }
    }

    // 2. Camada Complementar Gratuita: OpenStreetMap Nominatim (garante resultados mesmo sem chave Azure Maps)
    if (resultadosBrutos.length < 5) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&limit=${Math.min(limite, 30)}&q=${encodeURIComponent(termo + " " + cidadeObj.nome + " Brasil")}`;
        const nomRes = await fetch(nomUrl, { headers: { "Accept-Language": "pt-BR" } });
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          for (const item of nomData) {
            const nome = (item.name || (item.display_name || "").split(",")[0] || "").trim();
            if (!nome || vistos.has(nome.toLowerCase())) continue;
            vistos.add(nome.toLowerCase());
            const ext = item.extratags || {};
            const tel = ext.phone || ext["contact:phone"] || ext["contact:whatsapp"] || "NÃO ENCONTRADO";
            const site = ext.website || ext["contact:website"] || "";
            const end = item.display_name || cidadeObj.nome;
            const linkMapa = site && /^https?:\/\//i.test(site)
              ? site
              : `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=18/${item.lat}/${item.lon}`;

            const analise = calcularAderenciaVortice(nome, item.type || termo, site, tel);
            resultadosBrutos.push({
              nome,
              cidade: cidadeObj.nome,
              telefone: tel,
              website: site || "NÃO ENCONTRADO",
              endereco: end,
              categoria: item.type || termo,
              coordenadas: `${item.lat}, ${item.lon}`,
              linkProva: linkMapa,
              fonte: "OpenStreetMap Oficial",
              score: analise.score,
              classificacao: analise.classificacao,
              modulosRecomendados: analise.oportunidades,
              statusRevisao: "Aguardando Revisão"
            });
          }
        }
      } catch (e) {}
    }

    return resultadosBrutos.slice(0, limite);
  }

  return {
    OUTLOOK_OFICIAL,
    getRedirectUri,
    getMsAuthUrl,
    captureMsTokenFromHash,
    graphRequest,
    ensureOneDriveFolder,
    inicializarEstruturaOneDrive,
    uploadToOneDrive,
    sendOutlookMail,
    sendNotification,
    registrarVisita,
    criarCheckoutMercadoPago,
    buscarCidadesIBGE,
    investigarCidadeDetalhado
  };
})();
