import { useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { Button, EmptyState, Spinner, StageBadge } from '../../components/ui'
import { usePendingReminders, useDismissReminder } from '../../lib/queries'

export default function RemindersPanel() {
  const { data: reminders, isLoading } = usePendingReminders()
  const dismissMutation = useDismissReminder()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const pendingList = reminders ?? []

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        index="06"
        title="Follow-ups"
        subtitle="Applications gone quiet that need your attention."
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <Spinner />
        ) : pendingList.length === 0 ? (
          <EmptyState
            title="No applications need follow-up right now"
            hint="Pursuit scans your pipeline daily. Stale applications will automatically appear here."
          />
        ) : (
          <div className="space-y-6 max-w-3xl">
            {pendingList.map((item) => {
              const currentText = drafts[item.id] ?? item.draftEmail ?? 'No draft email available.'
              const isCopied = copiedId === item.id

              return (
                <div
                  key={item.id}
                  className="press !shadow-hard p-5 bg-[#FBF8F0] border-1.5 border-[#1A1712] flex flex-col"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wider text-[#5C5446] block">
                        {item.application.company}
                      </span>
                      <span className="font-display text-base font-black text-[#1A1712] block mt-0.5">
                        {item.application.roleTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <StageBadge stage={item.application.stage} />
                      <span className="font-mono text-[10px] text-[#5C5446]">
                        {item.daysSince} days since update
                      </span>
                    </div>
                  </div>

                  {item.draftEmail ? (
                    <div className="mt-2">
                      <label className="label block mb-1">Follow-up Draft</label>
                      <textarea
                        value={currentText}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        className="field w-full min-h-[140px] font-mono text-[11px] bg-paper-3 resize-y"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 p-4 border border-dashed border-[#1A171233] bg-[#1A171206]">
                      <p className="font-mono text-xs text-ink-faint">
                        Follow-up email draft failed to generate. Check your LLM API configuration.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t-1.5 border-[#1A17121a]">
                    <div className="flex items-center gap-2">
                      {item.draftEmail && (
                        <Button
                          variant="signal"
                          onClick={() => handleCopy(item.id, currentText)}
                        >
                          {isCopied ? 'Copied! ✓' : 'Copy email'}
                        </Button>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => dismissMutation.mutate(item.id)}
                      disabled={dismissMutation.isPending}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
