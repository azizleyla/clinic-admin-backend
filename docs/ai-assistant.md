# AI Assistant (simptom / filial yönləndirmə)

Claude-un tool-use xüsusiyyəti ilə istifadəçini simptoma və ya yerə görə düzgün
şöbə/filial və oradakı aktiv həkimlərə yönləndirən modul.

Kod: `src/modules/ai/` (`ai.service.js`, `ai.controller.js`, `ai.routes.js`),
`server.js`-də `/ai` altında qoşulub.

## Endpoint-lər

### `POST /ai/match-department`
Body: `{ "symptom": "başım gicəllənir, döş ağrısı var" }`

Simptoma əsasən uyğun **şöbəni** (`departments` cədvəli) tapır, tool çağırılarsa
o şöbədəki aktiv həkimləri qaytarır.

### `POST /ai/find-branch`
Body: `{ "location": "Nəsimi rayonundayam" }`

Yerə əsasən uyğun **filialı** (`branches` cədvəli) tapır, tool çağırılarsa
o filialdakı aktiv həkimləri qaytarır.

### Hər ikisinin cavab formatı
```json
{
  "success": true,
  "status": 200,
  "data": {
    "message": "Claude-un mətn cavabı (ola bilər null, aşağıya bax)",
    "department" | "branch": { ... } | null,
    "doctors": [ ... ]
  },
  "message": "Sorğu uğurla emal olundu"
}
```
Claude simptom/yer **qeyri-müəyyəndirsə** tool çağırmır — yalnız aydınlaşdırıcı
sual (`message`) qayıdır, `department`/`branch` və `doctors` boş qalır.

## Arxitektura qərarları

- **SDK yox, `fetch`.** `@anthropic-ai/sdk` əvəzinə birbaşa
  `https://api.anthropic.com/v1/messages`-ə `fetch` atılır (`askClaude` funksiyası,
  `ai.service.js`). Hər iki üsul da eyni nəticəni verir, SDK sadəcə əlavə rahatlıq
  (tip yoxlaması, retry) verir — layihədə əvvəlki təcrübəyə uyğun olaraq `fetch`
  seçildi.
- **Açar yalnız backend-də.** `ANTHROPIC_API_KEY` `.env`-dədir, heç vaxt client-ə
  ötürülmür. Frontend-dən birbaşa Anthropic-ə fetch atmaq TƏHLÜKƏLİDİR — açar
  bundle-a düşər.
- **Departments/branches siyahısı system prompt-a inject olunur** (`departmentList`
  / `branchesList`) ki, Claude bazadakı real ID-ləri bilsin və `tool_use.input`-da
  uydurma ID qaytarmasın.
- **Tool nəticəsi Claude-a geri göndərilmir (hələ).** Hazırkı axın tək-addımlıdır:
  `user → Claude → tool_use → biz DB-dən çəkirik → raw data client-ə qayıdır`.
  Claude nəticəni "görmür", təbii dildə yekun şərh vermir. Növbəti tapşırıq elə
  budur (aşağıya bax).

## Öyrənilmiş dərslər / tez-tez rast gəlinən xətalar

- **Server restart lazımdır.** Node ESM heç nəyi "hot reload" etmir. `npm start`
  (sadə `node`) əvəzinə **`npm run dev`** (nodemon) işlət — fayl saxlanan kimi
  avtomatik restart olur.
- **Zombie proseslər.** Köhnə `node` prosesi tam bağlanmadan yenisini işə salsan,
  yeni proses portu tuta bilmir, bütün sorğular köhnə (dəyişməmiş) koda gedir.
  Simptom: kod dəyişib amma nəticə dəyişmir / yeni route 404 verir. Yoxlama:
  `Get-Process node` (PowerShell) ilə neçə `node.exe` işlədiyinə bax, artıq olanları
  `Stop-Process -Id <id> -Force` ilə bağla.
- **`block.text` vs `block.content`.** Anthropic cavabında mətn bloku
  `{ type: "text", text: "..." }` şəklindədir — sahə adı `text`-dir, `content` yox.
- **`getDoctorsService`-ə `statuses: ["active"]` ötür.** Vermə­sən status filtri
  tətbiq olunmur, bütün (o cümlədən deaktiv) həkimlər qayıdır.
- **Tool nəticəsini yoxla.** Claude-un qaytardığı `department_id` / `branch_id`
  bazada mövcud olmaya bilər (modelin xəyali dəyər qaytarması) — `departments`/
  `branches` siyahısında `find` ilə təsdiqlə, tapılmasa `null` qaytar (hazırkı kod
  bunu artıq edir).

## Növbəti tapşırıq: tool nəticəsini Claude-a qaytarmaq (multi-turn)

Məqsəd: Claude-un DB-dən tapılan nəticəni "görüb" təbii dildə yekun cavab
yazması (məs. "Əhmədli filialında Səbinə Əhmədova adlı nevropotoloq var...").

Addımlar:
1. İlk cavabdakı `tool_use` block-dan sonra dayanma.
2. `messages` array-ini genişləndir:
   ```js
   messages: [
     { role: "user", content: symptom },
     { role: "assistant", content: firstResponse.content },
     {
       role: "user",
       content: [
         {
           type: "tool_result",
           tool_use_id: toolUseBlock.id,
           content: JSON.stringify(doctors),
         },
       ],
     },
   ]
   ```
3. Bu `messages` ilə Anthropic-ə **ikinci** sorğu at (`tools` sahəsini yenə göndər).
4. İkinci cavabdakı `text` block artıq Claude-un tool nəticəsinə əsaslanan yekun
   izahıdır — bunu `message` kimi qaytar.

Diqqət: `tool_use_id` ilk cavabdakı `tool_use` block-un öz `id`-si ilə **dəqiq**
uyğun olmalıdır, əks halda Anthropic 400 xətası verir. `tool_result.content`-ə
bütün həkim obyektini yox, yalnız lazımi sahələri (ad, ixtisas, telefon) ötür ki,
token israf olmasın.

## Təhlükəsizlik qeydi (ayrıca həll olunmalıdır)

`fd43fa0` commit-i `.env`-i tracking-dən çıxarıb, amma DB/Supabase açarları bundan
əvvəlki commit-lərdə git history-də qalıb və repo public-dirsə, hələ də oradan
oxuna bilər. Bu açarlar (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`) **rotasiya olunmalı** və mümkünsə history-dən təmizlənməlidir
(`git filter-repo` və ya BFG). `ANTHROPIC_API_KEY` isə heç vaxt commit olunmayıb —
`.gitignore`-da `.env` artıq var, bu təhlükə yoxdur.
