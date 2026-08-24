import { useEffect, useState } from "react";
import {
  CheckboxField,
  Field,
  FieldArea,
  FieldDate,
  FieldText,
  SelectField,
  StringListField,
  compactStrings,
  pruneEmpty,
} from "../components/FormFields.jsx";

function useSyncDraft(data, onChange) {
  useEffect(() => {
    onChange?.(data);
    // intentionally sync once when the form mounts / remounts (keyed by parent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const ROLE_TYPES = [
  "Individual Contributor",
  "Architect",
  "Project Manager",
  "Mentor",
  "Tech Lead",
  "Consultant",
  "Team Lead",
  "Designer",
  "Researcher",
  "Subject Matter Expert",
];

const PROJECT_CATEGORIES = ["professional", "hobby", "volunteer", "educational"];

const EDUCATION_TYPES = [
  "university",
  "community_college",
  "high_school",
  "trade_school",
  "bootcamp",
  "certificate_program",
  "online_course",
  "military_training",
  "apprenticeship",
  "other",
];

export function GeneralForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    name: "",
    title: "",
    summary: "",
    links: [],
    specialties: [],
    strengths: [],
    interests: [],
    disinterests: [],
    ...initial,
    contact: {
      location: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      ...initial?.contact,
    },
    career_goals: {
      short_term: [],
      long_term: [],
      ...initial?.career_goals,
    },
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  function updateContact(patch) {
    update({ contact: { ...data.contact, ...patch } });
  }

  return (
    <div className="form-grid">
      <FieldText label="Name" value={data.name} onChange={(name) => update({ name })} />
      <FieldText label="Title" value={data.title} onChange={(title) => update({ title })} />
      <FieldArea label="Summary" value={data.summary} onChange={(summary) => update({ summary })} />
      <FieldText
        label="Location"
        value={data.contact.location}
        onChange={(location) => updateContact({ location })}
      />
      <FieldText
        label="Email"
        value={data.contact.email}
        onChange={(email) => updateContact({ email })}
      />
      <FieldText
        label="Phone"
        value={data.contact.phone}
        onChange={(phone) => updateContact({ phone })}
      />
      <FieldText
        label="Website"
        value={data.contact.website}
        onChange={(website) => updateContact({ website })}
      />
      <FieldText
        label="Address"
        value={data.contact.address}
        onChange={(address) => updateContact({ address })}
      />
      <Field label="Links">
        <div className="string-list">
          {(data.links ?? []).map((link, index) => (
            <div className="nested-block" key={index}>
              <FieldText
                label="Label"
                value={link.label}
                onChange={(label) => {
                  const links = [...data.links];
                  links[index] = { ...links[index], label };
                  update({ links });
                }}
              />
              <FieldText
                label="URL"
                value={link.url}
                onChange={(url) => {
                  const links = [...data.links];
                  links[index] = { ...links[index], url };
                  update({ links });
                }}
              />
              <button
                type="button"
                className="btn"
                data-tooltip="Remove link"
                onClick={() =>
                  update({ links: data.links.filter((_, i) => i !== index) })
                }
              >
                Remove link
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            data-tooltip="Add link"
            onClick={() =>
              update({ links: [...(data.links ?? []), { label: "", url: "" }] })
            }
          >
            Add link
          </button>
        </div>
      </Field>
      <StringListField
        label="Short-term goals"
        values={data.career_goals.short_term}
        onChange={(short_term) =>
          update({ career_goals: { ...data.career_goals, short_term } })
        }
      />
      <StringListField
        label="Long-term goals"
        values={data.career_goals.long_term}
        onChange={(long_term) =>
          update({ career_goals: { ...data.career_goals, long_term } })
        }
      />
      <StringListField
        label="Specialties"
        values={data.specialties}
        onChange={(specialties) => update({ specialties })}
      />
      <StringListField
        label="Strengths"
        values={data.strengths}
        onChange={(strengths) => update({ strengths })}
      />
      <StringListField
        label="Interests"
        values={data.interests}
        onChange={(interests) => update({ interests })}
      />
      <StringListField
        label="Disinterests"
        values={data.disinterests}
        onChange={(disinterests) => update({ disinterests })}
      />
    </div>
  );
}

export function prepareGeneral(data) {
  const contact = {};
  for (const key of ["location", "address", "website", "phone", "email"]) {
    if (data.contact?.[key]?.trim()) contact[key] = data.contact[key].trim();
  }
  const links = (data.links ?? [])
    .map((l) => ({ label: l.label?.trim(), url: l.url?.trim() }))
    .filter((l) => l.label && l.url);

  const career_goals = {
    short_term: compactStrings(data.career_goals?.short_term),
    long_term: compactStrings(data.career_goals?.long_term),
  };

  return pruneEmpty({
    name: data.name?.trim(),
    title: data.title?.trim(),
    summary: data.summary?.trim(),
    contact,
    links,
    career_goals:
      career_goals.short_term.length || career_goals.long_term.length
        ? career_goals
        : undefined,
    specialties: compactStrings(data.specialties),
    strengths: compactStrings(data.strengths),
    interests: compactStrings(data.interests),
    disinterests: compactStrings(data.disinterests),
  });
}

export function ExperienceForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    company: "",
    title: "",
    teams: [],
    location: "",
    start_date: "",
    end_date: "",
    current: false,
    summary: "",
    skills: [],
    silent_tags: [],
    languages: [],
    frameworks: [],
    platforms: [],
    tools: [],
    projects: [],
    committees: [],
    ...initial,
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  return (
    <div className="form-grid">
      <FieldText label="Company" value={data.company} onChange={(company) => update({ company })} />
      <FieldText label="Title" value={data.title} onChange={(title) => update({ title })} />
      <FieldText label="Location" value={data.location} onChange={(location) => update({ location })} />
      <FieldDate
        label="Start date"
        value={data.start_date}
        onChange={(start_date) => update({ start_date })}
      />
      <CheckboxField
        label="Current role"
        checked={data.current}
        onChange={(current) => update({ current })}
      />
      {!data.current ? (
        <FieldDate
          label="End date"
          value={data.end_date}
          onChange={(end_date) => update({ end_date })}
        />
      ) : null}
      <FieldArea label="Summary" value={data.summary} onChange={(summary) => update({ summary })} />
      <StringListField label="Teams" values={data.teams} onChange={(teams) => update({ teams })} />
      <StringListField label="Skills" values={data.skills} onChange={(skills) => update({ skills })} />
      <StringListField
        label="Silent tags"
        values={data.silent_tags}
        onChange={(silent_tags) => update({ silent_tags })}
        isPrivate
      />
      <StringListField
        label="Languages"
        values={data.languages}
        onChange={(languages) => update({ languages })}
      />
      <StringListField
        label="Frameworks"
        values={data.frameworks}
        onChange={(frameworks) => update({ frameworks })}
      />
      <StringListField
        label="Platforms"
        values={data.platforms}
        onChange={(platforms) => update({ platforms })}
      />
      <StringListField label="Tools" values={data.tools} onChange={(tools) => update({ tools })} />
      <StringListField
        label="Projects"
        values={data.projects}
        onChange={(projects) => update({ projects })}
      />
      <StringListField
        label="Committees"
        values={data.committees}
        onChange={(committees) => update({ committees })}
      />
    </div>
  );
}

export function prepareExperience(data) {
  const next = pruneEmpty({
    ...data,
    company: data.company?.trim(),
    title: data.title?.trim(),
    location: data.location?.trim() || undefined,
    start_date: data.start_date?.trim(),
    end_date: data.current ? undefined : data.end_date?.trim(),
    summary: data.summary?.trim() || undefined,
    teams: compactStrings(data.teams),
    skills: compactStrings(data.skills),
    silent_tags: compactStrings(data.silent_tags),
    languages: compactStrings(data.languages),
    frameworks: compactStrings(data.frameworks),
    platforms: compactStrings(data.platforms),
    tools: compactStrings(data.tools),
    projects: compactStrings(data.projects),
    committees: compactStrings(data.committees),
    current: Boolean(data.current),
  });
  if (next.current) delete next.end_date;
  return next;
}

export function EducationForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    type: "university",
    name: "",
    location: "",
    program_name: "",
    degree: "",
    graduation_date: "",
    start_date: "",
    end_date: "",
    highlights: [],
    ...initial,
    contact: { location: "", website: "", email: "", phone: "", ...initial?.contact },
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  return (
    <div className="form-grid">
      <SelectField
        label="Type"
        value={data.type}
        onChange={(type) => update({ type })}
        options={EDUCATION_TYPES}
      />
      <FieldText label="Name" value={data.name} onChange={(name) => update({ name })} />
      <FieldText
        label="Location"
        value={data.location}
        onChange={(location) => update({ location })}
      />
      <FieldText
        label="Program"
        value={data.program_name}
        onChange={(program_name) => update({ program_name })}
      />
      <FieldText label="Degree" value={data.degree} onChange={(degree) => update({ degree })} />
      <FieldDate
        label="Graduation date"
        value={data.graduation_date}
        onChange={(graduation_date) => update({ graduation_date })}
      />
      <FieldDate
        label="Start date"
        value={data.start_date}
        onChange={(start_date) => update({ start_date })}
      />
      <FieldDate
        label="End date"
        value={data.end_date}
        onChange={(end_date) => update({ end_date })}
      />
      <StringListField
        label="Highlights"
        values={data.highlights}
        onChange={(highlights) => update({ highlights })}
      />
    </div>
  );
}

export function prepareEducation(data) {
  return pruneEmpty({
    type: data.type,
    name: data.name?.trim(),
    location: data.location?.trim() || undefined,
    program_name: data.program_name?.trim() || undefined,
    degree: data.degree?.trim() || undefined,
    graduation_date: data.graduation_date?.trim() || undefined,
    start_date: data.start_date?.trim() || undefined,
    end_date: data.end_date?.trim() || undefined,
    highlights: compactStrings(data.highlights),
  });
}

export function SkillCategoryForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    name: "",
    items: [{ name: "", tags: [] }],
    ...initial,
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  return (
    <div className="form-grid">
      <FieldText
        label="Category name"
        value={data.name}
        onChange={(name) => update({ name })}
      />
      <Field label="Skills">
        <div className="string-list">
          {(data.items ?? []).map((item, index) => (
            <div className="nested-block" key={index}>
              <h4>Skill {index + 1}</h4>
              <FieldText
                label="Name"
                value={item.name}
                onChange={(name) => {
                  const items = [...data.items];
                  items[index] = { ...items[index], name };
                  update({ items });
                }}
              />
              <StringListField
                label="Tags"
                values={item.tags ?? []}
                onChange={(tags) => {
                  const items = [...data.items];
                  items[index] = { ...items[index], tags };
                  update({ items });
                }}
              />
              <button
                type="button"
                className="btn"
                data-tooltip="Remove skill"
                onClick={() =>
                  update({ items: data.items.filter((_, i) => i !== index) })
                }
              >
                Remove skill
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            data-tooltip="Add skill"
            onClick={() =>
              update({ items: [...(data.items ?? []), { name: "", tags: [] }] })
            }
          >
            Add skill
          </button>
        </div>
      </Field>
    </div>
  );
}

export function prepareSkillCategory(data) {
  return {
    name: data.name?.trim(),
    items: (data.items ?? [])
      .map((item) => {
        const tags = compactStrings(item.tags);
        const next = { name: item.name?.trim() };
        if (tags.length) next.tags = tags;
        return next;
      })
      .filter((item) => item.name),
  };
}

export function ProjectForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    name: "",
    _name: "",
    category: "professional",
    roles: [],
    company: "",
    team: "",
    school: "",
    start_date: "",
    end_date: "",
    current_project: false,
    summary: "",
    _summary: "",
    challenges: [],
    _challenges: [],
    lessons_learned: [],
    _lessons_learned: [],
    scale_and_scope: [],
    measurable_results: [],
    decisions_and_tradeoffs: [],
    technologies: [],
    tags: [],
    ...initial,
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  return (
    <div className="form-grid">
      <FieldText label="Name" value={data.name} onChange={(name) => update({ name })} />
      <FieldText
        label="Internal name"
        value={data._name}
        onChange={(_name) => update({ _name })}
        isPrivate
      />
      <SelectField
        label="Category"
        value={data.category}
        onChange={(category) => update({ category })}
        options={PROJECT_CATEGORIES}
      />
      <FieldText label="Company" value={data.company} onChange={(company) => update({ company })} />
      <FieldText label="Team" value={data.team} onChange={(team) => update({ team })} />
      <FieldText label="School" value={data.school} onChange={(school) => update({ school })} />
      <FieldDate
        label="Start date"
        value={data.start_date}
        onChange={(start_date) => update({ start_date })}
      />
      <CheckboxField
        label="Current project"
        checked={data.current_project}
        onChange={(current_project) => update({ current_project })}
      />
      {!data.current_project ? (
        <FieldDate
          label="End date"
          value={data.end_date}
          onChange={(end_date) => update({ end_date })}
        />
      ) : null}
      <FieldArea label="Summary" value={data.summary} onChange={(summary) => update({ summary })} />
      <FieldArea
        label="Private summary"
        value={data._summary}
        onChange={(_summary) => update({ _summary })}
        isPrivate
      />
      <Field label="Roles">
        <div className="string-list">
          {(data.roles ?? []).map((role, index) => (
            <div className="nested-block" key={index}>
              <SelectField
                label="Type"
                value={role.type}
                onChange={(type) => {
                  const roles = [...data.roles];
                  roles[index] = { ...roles[index], type };
                  update({ roles });
                }}
                options={ROLE_TYPES}
              />
              <FieldArea
                label="Description"
                value={role.description}
                onChange={(description) => {
                  const roles = [...data.roles];
                  roles[index] = { ...roles[index], description };
                  update({ roles });
                }}
              />
              <button
                type="button"
                className="btn"
                data-tooltip="Remove role"
                onClick={() =>
                  update({ roles: data.roles.filter((_, i) => i !== index) })
                }
              >
                Remove role
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            data-tooltip="Add role"
            onClick={() =>
              update({
                roles: [
                  ...(data.roles ?? []),
                  { type: "Individual Contributor", description: "" },
                ],
              })
            }
          >
            Add role
          </button>
        </div>
      </Field>
      <StringListField
        label="Challenges"
        values={data.challenges}
        onChange={(challenges) => update({ challenges })}
      />
      <StringListField
        label="Private challenges"
        values={data._challenges}
        onChange={(_challenges) => update({ _challenges })}
        isPrivate
      />
      <StringListField
        label="Lessons learned"
        values={data.lessons_learned}
        onChange={(lessons_learned) => update({ lessons_learned })}
      />
      <StringListField
        label="Private lessons"
        values={data._lessons_learned}
        onChange={(_lessons_learned) => update({ _lessons_learned })}
        isPrivate
      />
      <StringListField
        label="Scale and scope"
        values={data.scale_and_scope}
        onChange={(scale_and_scope) => update({ scale_and_scope })}
      />
      <StringListField
        label="Measurable results"
        values={data.measurable_results}
        onChange={(measurable_results) => update({ measurable_results })}
      />
      <StringListField
        label="Decisions and tradeoffs"
        values={data.decisions_and_tradeoffs}
        onChange={(decisions_and_tradeoffs) =>
          update({ decisions_and_tradeoffs })
        }
      />
      <StringListField
        label="Technologies"
        values={data.technologies}
        onChange={(technologies) => update({ technologies })}
      />
      <StringListField label="Tags" values={data.tags} onChange={(tags) => update({ tags })} />
    </div>
  );
}

export function prepareProject(data) {
  const roles = (data.roles ?? [])
    .map((r) => ({
      type: r.type,
      description: r.description?.trim(),
    }))
    .filter((r) => r.description);

  const next = {
    name: data.name?.trim(),
    category: data.category,
    challenges: compactStrings(data.challenges),
    _challenges: compactStrings(data._challenges),
    lessons_learned: compactStrings(data.lessons_learned),
    scale_and_scope: compactStrings(data.scale_and_scope),
    measurable_results: compactStrings(data.measurable_results),
    decisions_and_tradeoffs: compactStrings(data.decisions_and_tradeoffs),
    technologies: compactStrings(data.technologies),
  };

  if (data._name?.trim()) next._name = data._name.trim();
  if (data._summary?.trim()) next._summary = data._summary.trim();
  if (data.summary?.trim()) next.summary = data.summary.trim();
  if (data.company?.trim()) next.company = data.company.trim();
  if (data.team?.trim()) next.team = data.team.trim();
  if (data.school?.trim()) next.school = data.school.trim();
  if (data.start_date?.trim()) next.start_date = data.start_date.trim();
  if (data.current_project) {
    next.current_project = true;
  } else if (data.end_date?.trim()) {
    next.end_date = data.end_date.trim();
    next.current_project = false;
  }
  if (roles.length) next.roles = roles;
  if (data._lessons_learned?.length) {
    next._lessons_learned = compactStrings(data._lessons_learned);
  }
  const tags = compactStrings(data.tags);
  if (tags.length) next.tags = tags;

  return next;
}

export function CertificationForm({ initial, onChange }) {
  const [data, setData] = useState(() => ({
    name: "",
    issuer: "",
    issued_date: "",
    expired_date: "",
    url: "",
    tags: [],
    ...initial,
  }));
  useSyncDraft(data, onChange);

  function update(patch) {
    const next = { ...data, ...patch };
    setData(next);
    onChange?.(next);
  }

  return (
    <div className="form-grid">
      <FieldText label="Name" value={data.name} onChange={(name) => update({ name })} />
      <FieldText label="Issuer" value={data.issuer} onChange={(issuer) => update({ issuer })} />
      <FieldDate
        label="Issued"
        value={data.issued_date}
        onChange={(issued_date) => update({ issued_date })}
      />
      <FieldDate
        label="Expired"
        value={data.expired_date}
        onChange={(expired_date) => update({ expired_date })}
      />
      <FieldText label="URL" value={data.url} onChange={(url) => update({ url })} />
      <StringListField label="Tags" values={data.tags} onChange={(tags) => update({ tags })} />
    </div>
  );
}

export function prepareCertification(data) {
  return pruneEmpty({
    name: data.name?.trim(),
    issuer: data.issuer?.trim() || undefined,
    issued_date: data.issued_date?.trim() || undefined,
    expired_date: data.expired_date?.trim() || undefined,
    url: data.url?.trim() || undefined,
    tags: compactStrings(data.tags),
  });
}
