import useSWRInfinite from 'swr/infinite';

export interface AssessmentResponse {
    id: string;
    score: number;
    zone: string;
    pain: number;
    functionScore: number;
    createdAt: string;
}

export function useAssessmentHistory() {
    const getKey = (pageIndex: number, previousPageData: any) => {
        if (previousPageData && !previousPageData.meta?.hasMore) return null;
        if (pageIndex === 0) return `/api/patient/assessments?limit=10`;
        return `/api/patient/assessments?limit=10&before=${encodeURIComponent(previousPageData.meta?.nextCursor)}`;
    };

    const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<any>(
        getKey,
        async (url) => {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error?.message || 'Failed to load assessments');
            }
            return json;
        },
        {
            revalidateFirstPage: false,
        }
    );

    const assessments: AssessmentResponse[] = data
        ? data.flatMap((page) => page.data || [])
        : [];

    const loading = isLoading && assessments.length === 0;
    const loadingMore = isValidating && size > 1;
    const errorMsg = error ? error.message : null;
    const hasMore = data ? data[data.length - 1]?.meta?.hasMore : false;

    const loadMore = () => {
        if (hasMore && !isValidating) {
            setSize(size + 1);
        }
    };

    return {
        assessments,
        loading,
        loadingMore,
        error: errorMsg,
        hasMore,
        loadMore,
        refetch: () => mutate()
    };
}
