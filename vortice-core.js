/* VORTICE CORE v2.0 - Motor Dinâmico, Auth & Integração GitHub/Microsoft */
window.VorticeCore = (function () {
  const DEFAULT_ADMIN_EMAIL = "vorticesolucoesglobais@gmail.com";
  const DEFAULT_ADMIN_PASS = "Vortice@2026";

  // Lê configurações locais seguras do Admin
  function getSecrets() {
    try {
      return JSON.parse(localStorage.getItem("vortice_secrets") || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveSecrets(obj) {
    const cur = getSecrets();
    localStorage.setItem("vortice_secrets", JSON.stringify({ ...cur, ...obj }));
  }

  // Lê banco local/cache sincronizado com OneDrive
  function getDB() {
    try {
      const db = JSON.parse(localStorage.getItem("vortice_db") || "null");
      if (db) return db;
    } catch (e) {}
    return {
      empresas: [],
      users: [],
      notificacoes: {
        canalPadrao: "email",
        whatsappNumero: "",
        whatsappToken: "",
        whatsappUrl: "",
        emailAlerta: DEFAULT_ADMIN_EMAIL,
        webhooksExtras: [],
        eventos: {
          novoCandidato: { email: true, whatsapp: false },
          empresaOuro: { email: true, whatsapp: false },
          vendaCurso: { email: true, whatsapp: false },
          mentoriaAgendada: { email: true, whatsapp: false }
        }
      },
      investigador: {
        modulos: [
          "Módulo de Gestão",
          "Módulo de Assessoria Administrativa",
          "Módulo de Gestão Empresarial",
          "Módulo de Suporte Técnico - Informática",
          "Módulo de Assessoria de TI",
          "Módulo de Gestão de TI",
          "Módulo de Gestão de Redes - Redes Sociais",
          "Módulo de Gestão de Mídias Sociais",
          "Módulo de Uniformes",
          "Módulo de Brindes Personalizados para Empresa",
          "Módulo de Roupas e Roupas Estampadas para Empresa",
          "Módulo de Usinagem CNC",
          "Módulo de Corte a Laser",
          "Módulo de Modelagem 3D"
        ],
        sites: [
          "Google Maps", "Google Search", "Google Reviews", "Instagram Feed", "Instagram Comentários",
          "Facebook Pages", "Facebook Groups", "Facebook Marketplace", "LinkedIn Empresa", "LinkedIn Pessoas",
          "TikTok", "YouTube", "X (Twitter)", "Reclame Aqui", "Trustpilot", "TripAdvisor",
          "Glassdoor", "Yelp", "OLX", "Mercado Livre", "GetNinjas", "Workana", "oHub",
          "Sympla", "InfoJobs", "Bing Places", "Apple Maps", "Foursquare", "GuiaMais / Solutudo", "TeleListas"
        ],
        portes: [
          { id: "mei", nome: "MEI / Micro", faixa: "Até 10 funcionários" },
          { id: "pequena", nome: "Pequena (ME / EPP)", faixa: "10 a 49 funcionários" },
          { id: "media", nome: "Média", faixa: "50 a 249 funcionários" },
          { id: "grande", nome: "Grande", faixa: "+250 funcionários" }
        ],
        registros: [],
        logs: []
      }
    };
  }

  function saveDB(db) {
    localStorage.setItem("vortice_db", JSON.stringify(db));
  }

  // Carrega site-data.json e aplica no HTML sem afetar o Google Translate
  async function loadSiteData(basePath = ".") {
    try {
      const r = await fetch(basePath + "/site-data.json?t=" + Date.now());
      if (!r.ok) return null;
      const data = await r.json();
      window.SITE_DATA = data;
      applySiteVisuals(data, basePath);
      return data;
    } catch (e) {
      return null;
    }
  }

  function applySiteVisuals(data, basePath) {
    if (!data || !data.identidade) return;
    const id = data.identidade;
    if (id.corPrincipal) {
      document.documentElement.style.setProperty("--ac", id.corPrincipal);
    }
    if (id.corFundo) {
      document.documentElement.style.setProperty("--bg0", id.corFundo);
    }
    // Atualiza logos se alteradas no Admin
    document.querySelectorAll("header .bar img").forEach((img) => {
      if (id.logoUrl) img.src = id.logoUrl.startsWith("http") ? id.logoUrl : basePath + "/" + id.logoUrl.replace(/^\.\//, "");
    });
    // Controla visibilidade das 3 abas no menu
    if (data.abasVisiveis) {
      ["portal", "cursos", "contratacoes"].forEach((aba) => {
        const visivel = data.abasVisiveis[aba] !== false;
        document.querySelectorAll(`a[href*="${aba}"]`).forEach((a) => {
          a.style.display = visivel ? "" : "none";
        });
      });
    }
  }

  // Autenticação centralizada (Admin entra em tudo; outros só na sua aba)
  function login(email, password, areaAtual) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const secrets = getSecrets();
    const adminEmail = (secrets.adminEmail || DEFAULT_ADMIN_EMAIL).toLowerCase();
    const adminPass = secrets.adminPass || DEFAULT_ADMIN_PASS;

    // 1. Admin Geral (abre todas as áreas)
    if (cleanEmail === adminEmail && password === adminPass) {
      const sessao = { ok: true, role: "admin", nome: "Mathews Brito", email: cleanEmail };
      sessionStorage.setItem("vortice_sessao", JSON.stringify(sessao));
      return { ok: true, sessao };
    }

    // 2. Usuários cadastrados (Funcionário, Cliente, Aluno, Candidato)
    const db = getDB();
    const user = (db.users || []).find(
      (u) => (u.email || "").toLowerCase() === cleanEmail && u.senha === password && u.status !== "bloqueado"
    );

    if (!user) {
      return { ok: false, msg: "E-mail ou senha incorretos, ou acesso bloqueado." };
    }

    const areaPermitida = {
      funcionario: "portal",
      cliente: "portal",
      aluno: "cursos",
      candidato: "contratacoes"
    }[user.role];

    if (areaAtual && areaPermitida !== areaAtual) {
      return {
        ok: false,
        msg: "Esse acesso não é para essa área. Vá para Cursos e Mentorias ou Contratações."
      };
    }

    const sessao = {
      ok: true,
      role: user.role,
      nome: user.nome,
      email: user.email,
      empresaId: user.empresaId || null,
      empresasLiberadas: user.empresasLiberadas || [],
      acessoInvestigador: !!user.acessoInvestigador,
      nivelInvestigador: user.nivelInvestigador || "visualizador"
    };
    sessionStorage.setItem("vortice_sessao", JSON.stringify(sessao));
    return { ok: true, sessao };
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem("vortice_sessao") || "null");
    } catch (e) {
      return null;
    }
  }

  function logout() {
    sessionStorage.removeItem("vortice_sessao");
  }

  // Salva alterações do site diretamente no GitHub via API (sem precisar abrir código)
  async function publishToGitHub(filePath, contentObjOrBase64, commitMessage, isBase64 = false) {
    const s = getSecrets();
    if (!s.githubToken) {
      throw new Error("Configure o Token do GitHub em Admin > Configurações antes de publicar.");
    }
    const owner = "vorticesolucoesglobais-spec";
    const repo = "Votice-Site";
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    // Busca SHA atual do arquivo se existir
    let sha = undefined;
    const getRes = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${s.githubToken}`, Accept: "application/vnd.github+json" }
    });
    if (getRes.ok) {
      const info = await getRes.json();
      sha = info.sha;
    }

    const contentEncoded = isBase64
      ? contentObjOrBase64
      : btoa(unescape(encodeURIComponent(JSON.stringify(contentObjOrBase64, null, 2))));

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${s.githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: commitMessage || `Atualização via Painel Admin Vórtice (${filePath})`,
        content: contentEncoded,
        sha
      })
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || "Erro ao salvar no GitHub.");
    }
    return await putRes.json();
  }

  return {
    getSecrets,
    saveSecrets,
    getDB,
    saveDB,
    loadSiteData,
    login,
    getSession,
    logout,
    publishToGitHub
  };
})();
