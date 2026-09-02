// Test skripti: Claude simptomdan düzgün department-i (tool call ilə) tapır,
// sonra o department(lər) üçün real, aktiv həkimləri bazadan çəkib göstərir.
// İşlətmək üçün: node scripts/test-ai-department-match.js "başım gicəllənir"
import "dotenv/config";
import { getDepartmentsService } from "../src/modules/departments/departments.service.js";
import { getDoctorsService } from "../src/modules/doctors/doctors.service.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-opus-5";

const tools = [
  {
    name: "find_doctors",
    description: "Verilmiş şöbədə çalışan həkimləri tapır.",
    input_schema: {
      type: "object",
      properties: {
        department_id: {
          type: "integer",
          description: "Yuxarıdakı siyahıdan seçilmiş şöbənin id-si",
        },
      },
      required: ["department_id"],
    },
  },
];

function pickAz(localized) {
  if (!localized) return "";
  if (typeof localized === "string") return localized;
  return (
    localized.az ?? localized.en ?? localized.ru ?? Object.values(localized)[0] ?? ""
  );
}

async function askClaude({ system, symptom }) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools,
      messages: [{ role: "user", content: symptom }],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API xətası (${res.status})`);
  }

  return data;
}

async function main() {
  const symptom = process.argv[2] || "başım gicəllənir və təzyiqim yüksəkdir";

  const departments = await getDepartmentsService();
  const departmentList = departments
    .map((d) => `${d.id}: ${pickAz(d.title)}`)
    .join("\n");

  const system = `Sən klinikanın simptom-yönləndirmə köməkçisisən. İstifadəçinin
simptomuna əsasən, aşağıdakı mövcud şöbələrdən ən uyğun olanını seç və
find_doctors tool-unu çağır. Diaqnoz qoyma, dərman tövsiyə etmə - yalnız
hansı şöbəyə yönləndirmək lazım olduğunu müəyyən et.

Mövcud şöbələr (id: ad):
${departmentList}`;

  const response = await askClaude({ system, symptom });

  console.log("--- Simptom ---");
  console.log(symptom);
  console.log("--- Claude cavabı ---");




  for (const block of response.content) {
    if (block.type === "text") {
      console.log("[mətn]:", block.text);
    } else if (block.type === "tool_use") {

      if (block.name === "find_doctors") {
        const departmentId = block.input?.department_id;
        const department = departments.find((d) => d.id === departmentId);

        console.log(
          `--- "${pickAz(department?.title) || departmentId}" şöbəsi üçün həkimlər ---`,
        );

        const { items: doctors } = await getDoctorsService({
          departmentId,
          statuses: ["active"],
          paginate: false,
        });

        if (doctors.length === 0) {
          console.log("  (bu şöbədə aktiv həkim tapılmadı)");
        } else {
          doctors.forEach((doc) => {
            console.log(`  - #${doc.id} ${doc.name} (${doc.status})`);
          });
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
