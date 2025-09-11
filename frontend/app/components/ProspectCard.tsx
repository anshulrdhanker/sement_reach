import * as React from "react";
import { ExternalLink, MapPin, Building2, Briefcase, Sparkles, Timer, ChevronDown } from "lucide-react";

export type Prospect = {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  location?: string;
  linkedin_url?: string;
  company_size?: string;
  industry?: string;
  experience_years?: number | null;
  skills?: string[];
  _raw?: Record<string, any>;
};

export interface ProspectCardProps {
  prospect: Prospect;
  className?: string;
}

/* ---------- helpers ---------- */

function normalizeUrl(url?: string) {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
}

const joinTitleCompany = (title?: string, company?: string) =>
  title && company ? `${title} @ ${company}` : (title || company || "");

// Helper: years label
function yearsLabel(years?: number | null) {
  if (years == null || Number.isNaN(years)) return "";
  if (years < 1) return "0–1 yrs exp";
  if (years === 1) return "1 yr exp";
  return `${Math.floor(years)} yrs exp`;
}

// Small pill component
const MetaChip: React.FC<{ icon?: React.ReactNode; text: string; title?: string }> = ({ icon, text, title }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-50 text-gray-700 border border-gray-200"
    title={title ?? text}
  >
    {icon}
    <span className="truncate max-w-[10rem]">{text}</span>
  </span>
);

/* ---------- tiny chip ---------- */

const Chip: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span
    title={title}
    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700"
  >
    {children}
  </span>
);

/* ---------- skill pill ---------- */

const SkillPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
    {children}
  </span>
);

/* ---------- main card ---------- */

const ProspectCard: React.FC<ProspectCardProps> = ({ prospect, className }) => {
  const {
    name,
    title,
    company,
    email,
    location,
    linkedin_url,
    company_size,
    industry,
    experience_years,
    skills = [],
    _raw,
  } = prospect;

  const [skillsExpanded, setSkillsExpanded] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);
  
  const detailsId = React.useId();
  const subtitle = joinTitleCompany(title, company);
  const years = yearsLabel(experience_years);
  
  // Filter out any falsy skills and ensure they're strings
  const validSkills = (skills || []).filter(Boolean).map(String);
  const VISIBLE_SKILLS_COUNT = 6;
  const visibleSkills = skillsExpanded ? validSkills : validSkills.slice(0, VISIBLE_SKILLS_COUNT);
  const hiddenSkillsCount = Math.max(0, validSkills.length - VISIBLE_SKILLS_COUNT);
  
  const linkedInHref = normalizeUrl(linkedin_url);
  const hasLinkedIn = Boolean(linkedInHref);

  return (
    <article
      className={[
        "w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all",
        "hover:shadow-md focus-within:ring-2 focus-within:ring-black/10",
        className || "",
      ].join(" ")}
      aria-label={`Prospect card for ${name}`}
    >
      {/* top row: identity + action */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{name}</h3>
          {subtitle && (
            <p className="mt-0.5 truncate text-sm text-gray-600" aria-label="title and company">
              {subtitle}
            </p>
          )}
          
          {/* Meta chips row */}
          {(location || company_size || industry || experience_years != null) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {location && (
                <MetaChip
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  text={location}
                  title={location}
                />
              )}

              {company_size && (
                <MetaChip
                  icon={<Building2 className="h-3.5 w-3.5" />}
                  text={company_size}
                  title={`Company size: ${company_size}`}
                />
              )}

              {industry && (
                <MetaChip
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                  text={industry}
                  title={`Industry: ${industry}`}
                />
              )}

              {years && (
                <MetaChip
                  icon={<Timer className="h-3.5 w-3.5" />}
                  text={years}
                  title={years}
                />
              )}
            </div>
          )}
        </div>

        {hasLinkedIn ? (
          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View LinkedIn profile"
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium border-gray-200 text-gray-800 hover:bg-gray-50 active:bg-gray-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            LinkedIn
          </a>
        ) : (
          <button
            type="button"
            aria-label="LinkedIn not available"
            disabled
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium cursor-not-allowed border-gray-100 text-gray-300"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            LinkedIn
          </button>
        )}
      </header>


      {/* Skills Section */}
      {validSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {visibleSkills.map((skill, index) => (
            <span
              key={index}
              className="px-2 py-0.5 text-xs rounded-full border border-gray-200 bg-white text-gray-700 max-w-[10rem] overflow-hidden text-ellipsis whitespace-nowrap"
              title={skill}
            >
              {skill}
            </span>
          ))}
          {!skillsExpanded && hiddenSkillsCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSkillsExpanded(true);
              }}
              className="px-2 py-0.5 text-xs rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-expanded={skillsExpanded}
            >
              +{hiddenSkillsCount} more
            </button>
          )}
          {skillsExpanded && hiddenSkillsCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSkillsExpanded(false);
              }}
              className="px-2 py-0.5 text-xs rounded-full border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
              aria-expanded={skillsExpanded}
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* Details Toggle */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-sm"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
        >
          <span>{detailsOpen ? 'Hide details' : 'Details'}</span>
          <ChevronDown 
            className={`h-3 w-3 transition-transform ${detailsOpen ? 'rotate-180' : 'rotate-0'}`} 
            aria-hidden="true"
          />
        </button>
        
        {/* Details Content */}
        <div
          id={detailsId}
          className={`transition-all overflow-hidden ${detailsOpen ? 'mt-2 max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="space-y-1 text-xs text-gray-600">
            {email && (
              <div>
                <span className="text-gray-400 mr-1">Email:</span>
                <a 
                  href={`mailto:${email}`}
                  className="text-gray-700 hover:text-gray-900 hover:underline"
                >
                  {email}
                </a>
              </div>
            )}
            {location && (
              <div>
                <span className="text-gray-400 mr-1">Location:</span>
                {location}
              </div>
            )}
            {company_size && (
              <div>
                <span className="text-gray-400 mr-1">Company size:</span>
                {company_size}
              </div>
            )}
            {industry && (
              <div>
                <span className="text-gray-400 mr-1">Industry:</span>
                {industry}
              </div>
            )}
            {experience_years != null && (
              <div>
                <span className="text-gray-400 mr-1">Experience:</span>
                {years}
              </div>
            )}
            {hasLinkedIn && (
              <div>
                <a
                  href={linkedInHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 underline underline-offset-2 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-sm"
                >
                  View LinkedIn →
                </a>
              </div>
            )}
            {_raw && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-sm"
                  aria-expanded={showRaw}
                >
                  {showRaw ? 'Hide raw data' : 'View raw data'}
                </button>
                {showRaw && (
                  <pre className="mt-1 p-2 text-xs bg-gray-50 border border-gray-200 rounded-md overflow-auto max-h-48">
                    {JSON.stringify(_raw, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProspectCard;
