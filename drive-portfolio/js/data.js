/*
 * ============================================================
 *  All portfolio text for the driving game lives here
 *  (kept in sync with the website in ../Portfolio).
 *  Each item in `sections` becomes a stop in the 3D world
 *  (add or remove sections; the world re-arranges itself).
 *  `body` accepts plain HTML.
 * ============================================================
 */
window.PORTFOLIO = {
  name: "Sachayanthan V",
  shortName: "SACHAYANTHAN V",
  role: "MTS-3 · Senior Software Developer at Aquera",
  tagline: "Robotics engineer × software developer × AI builder — I turn requirements into real-world systems.",
  website: "../Portfolio/index.html",

  sections: [
    {
      id: "about",
      title: "About Me",
      color: "#7c3aed",
      body: `
        <p>I'm <b>Sachayanthan V</b> — you can call me <b>Sachin</b>. I'm an <b>MTS-3 (Senior Software Developer) at Aquera</b>,
        focused on <b>system integrations and automation</b> and the reusable engine underneath them.</p>
        <p>I started in electronics &amp; robotics, moved into enterprise integration at TCS, trained in full-stack MERN,
        and today I also orchestrate AI-assisted workflows with human review at every step.</p>
        <div class="stats">
          <div><b>5+</b><span>years</span></div><div><b>60+</b><span>integrations</span></div>
          <div><b>70+</b><span>customers</span></div><div><b>110+</b><span>reusable products</span></div>
        </div>`
    },
    {
      id: "projects",
      title: "Projects",
      color: "#db2777",
      body: `
        <div class="card"><span class="tag">My product</span><h4>Zungga — Kids Learning Platform</h4>
          <p>Turning screen time into skill time for kids — from idea to a live platform.</p>
          <a href="https://zungga.com" target="_blank" rel="noopener">Visit zungga.com →</a></div>
        <div class="card"><span class="tag">Integration</span><h4>Enterprise Identity Integration</h4>
          <p>HR systems, Active Directory and Microsoft Entra connected into one reliable onboarding / offboarding flow.</p></div>
        <div class="card"><span class="tag">Platform</span><h4>Reusable Integration Engine</h4>
          <p>Core engine improvements so new connectors (ADP, Dayforce, Workday…) ship in days, not weeks.</p></div>
        <div class="card"><span class="tag">AI</span><h4>AI Workflow Orchestration</h4>
          <p>Every AI tool gets a role — requirements, build, QA, reporting — coordinated with human review.</p></div>
        <p class="note">Professional work is NDA-bound, so these are high-level case studies.</p>`
    },
    {
      id: "experience",
      title: "Journey",
      color: "#2563eb",
      body: `
        <div class="timeline">
          <div><b>Jan 2026 – Present</b><br>MTS-3 / Senior Software Developer — Aquera<br>
          <small>System integrations &amp; automations across ADP, Dayforce, Workday, Jira, ServiceNow, Entra ID and AD; engine improvements, customer delivery, mentoring.</small></div>
          <div><b>Dec 2024</b><br>MTS-2 — Aquera<br><small>IAM, HR and directory connectors; OpenAPI-driven integrations.</small></div>
          <div><b>May 2021 – Dec 2024</b><br>Integration Developer — TCS<br><small>Migrated legacy IBM IIB interfaces to Dell Boomi; built new complex integrations.</small></div>
          <div><b>2022 – 2023</b><br>Full Stack MERN — Coding Ninjas<br><small>Top Performer in four courses.</small></div>
          <div><b>2018 – 2021</b><br>B.E. Mechatronics Engineering — Rajalakshmi Engineering College</div>
          <div><b>2016 – 2018</b><br>Diploma, Electronics &amp; Robotics Engineering — S.A.P.T.C, Thellar</div>
        </div>`
    },
    {
      id: "skills",
      title: "Skills",
      color: "#0f9f8f",
      body: `
        <h4>Systems I integrate &amp; automate</h4>
        <div class="chips"><span>ADP Workforce Now</span><span>Dayforce</span><span>Workday</span><span>Jira</span>
          <span>ServiceNow</span><span>Microsoft Entra ID</span><span>Active Directory</span><span>SFTP</span></div>
        <h4>Backend &amp; integration</h4>
        <div class="chips"><span>Node.js</span><span>JavaScript</span><span>Express</span><span>Python</span>
          <span>Dell Boomi</span><span>Apigee</span><span>OpenAPI</span><span>IAM</span></div>
        <h4>Cloud, data &amp; product</h4>
        <div class="chips"><span>AWS</span><span>MongoDB</span><span>React</span><span>MERN</span><span>System design</span></div>
        <h4>AI &amp; robotics</h4>
        <div class="chips"><span>AI orchestration</span><span>Computer vision</span><span>Hardware–software integration</span><span>Intelligent automation</span></div>`
    },
    {
      id: "workstyle",
      title: "Work Style",
      color: "#ea580c",
      body: `
        <p><b>Agile, end to end — and accountable after go-live.</b> For 5.5+ years I've worked directly with customers.</p>
        <ol class="steps">
          <li>Talk to the customer</li><li>Gather requirements</li><li>Understand real needs</li>
          <li>Design the system &amp; flow</li><li>Build</li><li>Test</li><li>Push to production</li>
          <li>Ship to the customer</li><li>Test on their instance (safe limits)</li><li>2-week hypercare</li>
        </ol>
        <div class="stats">
          <div><b>4.6/5</b><span>customer rating</span></div><div><b>5.5+</b><span>years with customers</span></div>
          <div><b>25+</b><span>colleagues trained</span></div><div><b>10+</b><span>customers retained</span></div>
        </div>
        <p class="note">Any issue at any stage is mine to resolve — until the customer is using their product safely.</p>`
    },
    {
      id: "recognition",
      title: "Recognition",
      color: "#9333ea",
      body: `
        <div class="card"><h4>🏆 National-level recognition</h4><p>1st Prize — Smart India Hackathon</p></div>
        <div class="card"><h4>⚙️ Engineering beyond software</h4><p>AI, computer vision, robotics and hardware–software integration</p></div>
        <div class="card"><h4>🤝 Customer impact</h4><p>70+ customers served · 4.6/5 rating</p></div>
        <div class="card"><h4>⭐ Certified</h4><p>Coding Ninjas — Top Performer in Back End (Node.js), Front End, Data Structures (Python) and Python.</p></div>`
    },
    {
      id: "contact",
      title: "Contact",
      color: "#c026d3",
      body: `
        <p>Open to new opportunities, interesting problems, or just connecting.</p>
        <a class="cta" href="https://calendly.com/sachayanthan-v-1999/hire-me" target="_blank" rel="noopener">📅 Book a 15-minute call</a>
        <ul class="links">
          <li><a href="mailto:sachayanthan.v.1999@gmail.com">sachayanthan.v.1999@gmail.com</a></li>
          <li><a href="https://www.linkedin.com/in/sachayanthan-v-jain-040838150/" target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href="https://github.com/Sachayanthan-V" target="_blank" rel="noopener">GitHub</a></li>
          <li><a href="https://www.instagram.com/sachin_1999_20_01/" target="_blank" rel="noopener">Instagram</a></li>
          <li><a href="../Portfolio/assets/Sachayanthan_V_Resume.pdf" download>Download résumé</a></li>
        </ul>`
    }
  ]
};
