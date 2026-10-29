export interface ProposalDraft {
  ideaText: string;
  ideaFile: File | null;
  proposals: File[];
}

export const emptyProposalDraft = (): ProposalDraft => ({
  ideaText: '', ideaFile: null, proposals: [],
});

export function isProposalDraftReady(draft: ProposalDraft): boolean {
  return Boolean(draft.ideaFile || draft.ideaText) && draft.proposals.length >= 2;
}
