import { ArrowLeft2, ArrowRight2 } from "iconsax-react";
import { Button } from "@renderer/components/ui/Button";

type PaginationControlsProps = {
  page: number;
  totalHits: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

const getPageCount = (totalHits: number, pageSize: number) => {
  if (pageSize <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(totalHits / pageSize));
};

export const PaginationControls = ({
  page,
  totalHits,
  pageSize,
  hasPreviousPage,
  hasNextPage,
  loading,
  onPrevious,
  onNext
}: PaginationControlsProps) => {
  const totalPages = getPageCount(totalHits, pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--field-radius)] border border-[var(--panel-border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">
      <p className="text-[var(--muted-text)]">
        Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrevious} disabled={!hasPreviousPage || loading}>
          <ArrowLeft2 size={16} variant="Linear" className="mr-2" />
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNextPage || loading}>
          Next
          <ArrowRight2 size={16} variant="Linear" className="ml-2" />
        </Button>
      </div>
    </div>
  );
};
