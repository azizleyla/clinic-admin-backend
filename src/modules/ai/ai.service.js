import { AppError } from "../../common/AppError.js"
import { getBranchesService } from "../branches/branches.service.js"
import { getDepartmentsService } from "../departments/departments.service.js"
import { getDoctorsService } from "../doctors/doctors.service.js"

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"
const MODEL = "claude-opus-5"

const tools = [
  {
    name: "find_doctors",
    description: "Verilmiş şöbədə çalışan həkimləri tapır.",
    input_schema: {
      type: "object",
      properties: {
        department_id: {
          type: "integer",
          description: "Mövcud şöbələr siyahısından seçilmiş şöbənin id-si",
        },
      },
      required: ["department_id"],
    },
  },
  {
    name: "find_branch",
    description: "Verilmiş filiala uyğun həkimləri tapır",
    input_schema: {
      type: "object",
      properties: {
        branch_id: {
          type: "integer",
          description: "Mövcud filiallar siyahısından seçilmiş filialin id-si",
        }
      },
      required: ["branch_id"],

    }
  }
]

function pickAz(localized) {
  if (!localized) return ""
  if (typeof localized === "string") return localized
  return (
    localized.az ?? localized.en ?? localized.ru ?? Object.values(localized)[0] ?? ""
  )
}

async function askClaude({ system, question }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const err = new AppError(
      "ANTHROPIC_API_KEY .env faylında olmalıdır (console.anthropic.com/settings/keys)",
      503,
    )
    throw err
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      tools,
      messages: [{ role: "user", content: question }],
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new AppError(data?.error?.message || "Anthropic API xətası", 502)
  }

  return data
}

/**
 * Simptoma əsasən uyğun şöbəni tapır və o şöbədəki aktiv həkimləri qaytarır.
 * Simptom qeyri-müəyyəndirsə, Claude tool çağırmır - yalnız aydınlaşdırıcı sual (message) qayıdır.
 * 
 */

export async function matchBranchByLocationService(location) {
  const trimmed = String(location ?? "").trim()
  if (!trimmed) {
    throw new AppError("Location boş ola bilməz", 400)
  }
  const branches = await getBranchesService();
  const branchesList = branches
    .map((d) => `${d.id}: ${pickAz(d.name)}`)
    .join("\n")

  const system = `Sən klinikanın filiala esasen hekim tapmaq komekcicisen. İstifadəçinin
yazdigi locationa əsasən, aşağıdakı mövcud filiallardan ən uyğun olanını seç və
find_branch tool-unu çağır.find_branch tool-unu çağırmazdan əvvəl 1 cümləlik qısa izah ver ki, niyə bu filialı seçdin. Diaqnoz qoyma, dərman tövsiyə etmə - yalnız
hansı filiala yönləndirmək lazım olduğunu müəyyən et. Filial qeyri-müəyyəndirsə,
tool çağırma - əvəzinə aydınlaşdırıcı sual ver.
Mövcud filiallar (id: ad):
${branchesList}`

  const response = await askClaude({ system, question: trimmed })
  let message = null;
  let doctors = null;
  let branch = null;
  for (const block of response.content) {
    if (block.type === "text") {
      message = block.text;
    } else if (block.type === "tool_use" && block.name === "find_branch") {
      const branchId = block.input?.branch_id;
      console.log(branches, 'bb')
      branch = branches.find((branch) => branch.id === branchId) ?? null;
      const { items } = await getDoctorsService({
        branchId,
        statuses: ["active"],
        paginate: false,
      })
      doctors = items
    }
  }
  return { message, branch, doctors }

}
export async function matchDepartmentBySymptomService(symptom) {
  const trimmed = String(symptom ?? "").trim()
  if (!trimmed) {
    throw new AppError("Simptom mətni boş ola bilməz", 400)
  }

  const departments = await getDepartmentsService()
  const departmentList = departments
    .map((d) => `${d.id}: ${pickAz(d.title)}`)
    .join("\n")

  const system = `Sən klinikanın simptom-yönləndirmə köməkçisisən. İstifadəçinin
simptomuna əsasən, aşağıdakı mövcud şöbələrdən ən uyğun olanını seç və
find_doctors tool-unu çağır. Diaqnoz qoyma, dərman tövsiyə etmə - yalnız
hansı şöbəyə yönləndirmək lazım olduğunu müəyyən et. Simptom qeyri-müəyyəndirsə,
tool çağırma - əvəzinə aydınlaşdırıcı sual ver.

Mövcud şöbələr (id: ad):
${departmentList}`

  const response = await askClaude({ system, question: trimmed })

  let message = null
  let department = null
  let doctors = []

  for (const block of response.content ?? []) {
    if (block.type === "text") {
      message = block.text
    } else if (block.type === "tool_use" && block.name === "find_doctors") {
      const departmentId = block.input?.department_id
      department = departments.find((d) => d.id === departmentId) ?? null

      const { items } = await getDoctorsService({
        departmentId,
        statuses: ["active"],
        paginate: false,
      })
      doctors = items
    }
  }

  return { message, department, doctors }
}
