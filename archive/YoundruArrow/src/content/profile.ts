export const profile = {
  name: 'Sachayanthan V',
  email: 'sachayanthan.v.1999@gmail.com',
  github: 'https://github.com/Sachayanthan-V/',
  linkedin: 'https://www.linkedin.com/in/sachayanthan-v-jain-040838150/',
  zungga: 'https://zungga.com/',
  resume: `${import.meta.env.BASE_URL}resume/Sachayanthan-V-Resume.pdf`,
};
export const chapters = [
  { id: 'intro', label: 'Introduction', short: 'Intro' },
  { id: 'systems', label: 'Connected systems', short: 'Systems' },
  { id: 'workflow', label: 'AI workflow', short: 'AI workflow' },
  { id: 'impact', label: 'Real outcomes', short: 'Impact' },
  { id: 'zungga', label: 'Zungga', short: 'Zungga' },
  { id: 'journey', label: 'Journey & contact', short: 'Journey' },
];
export const stages = [
  { title: 'Understand', label: 'Context & requirements', icon: '01', input: 'Customer requirements', output: 'A focused implementation brief', description: 'Specialized skills gather application context, connector capabilities, and requirements to give the next stage a useful starting point.', example: 'A synthetic request: connect employee changes to an identity directory.' },
  { title: 'Design', label: 'Architecture & features', icon: '02', input: 'Implementation brief', output: 'A proposed integration design', description: 'Design and feature personas break the request into an implementation approach and smaller, well-defined tasks.', example: 'Outline the field mapping, lifecycle rules, and expected behavior.' },
  { title: 'Build', label: 'Developer personas', icon: '03', input: 'Design and scoped tasks', output: 'An implementation to validate', description: 'Three developer personas work with task-specific skills and the relevant application context to implement the integration.', example: 'Build the data mapping and connector behavior for the sample request.' },
  { title: 'Validate', label: 'QA & feedback', icon: '04', input: 'Implementation and expected behavior', output: 'Test results and issues to address', description: 'QA personas exercise the implementation and provide feedback for the next development pass.', example: 'Check synthetic updates, missing fields, and expected error behavior.' },
  { title: 'Implement', label: 'Product & customer delivery', icon: '05', input: 'Validated engineering work', output: 'An integration ready for customer UAT', description: 'Implementation workflows bring the work into the product and support delivery. Customer acceptance testing remains a separate step.', example: 'Prepare the sample configuration and confirm the implementation behavior.' },
  { title: 'Report', label: 'Visibility & escalation', icon: '06', input: 'Execution results and blockers', output: 'A completion report or escalation', description: 'Manager and reporting personas summarize what happened, report completion, and escalate when the workflow needs input.', example: 'Produce a clear result summary or request a decision on a blocker.' },
];
export const roles = [
  { date: 'JAN 2026 — PRESENT', company: 'Aquera', title: 'MTS-3 · Senior Software Developer', tag: 'Current chapter', text: 'Upgrading the core integration engine. Building AI workflows. Taking customer requirements all the way to implementation.', detail: 'Promoted in January 2026. Trained 8+ colleagues, expanded reusable integration products, and took on forward-deployed engineering responsibilities alongside backend development.' },
  { date: 'DEC 2024 — DEC 2025', company: 'Aquera', title: 'MTS-2 · Backend Developer', tag: 'Product engineering', text: 'Building connectors and custom integrations across HR applications, identity systems, and directories.', detail: 'Joined on December 18, 2024. Individually built integrations and reusable products and supported direct customer implementation through go-live.' },
  { date: 'MAY 2021 — DEC 2024', company: 'Tata Consultancy Services', title: 'Integration Developer', tag: 'The foundation', text: 'Connecting enterprise systems with Boomi, Apigee, and automation across development, testing, and deployment.', detail: 'Worked through December 17, 2024. Integration experience includes SAP, QAD, Workday, Ariba, and other enterprise systems, alongside JavaScript and Python scripting.' },
];
