import useSWR from 'swr';

export interface PatientProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    mobile?: string;
    notificationPrefs?: Record<string, boolean>;
    latestAssessment?: {
        id: string;
        score: number;
        zone: string;
        createdAt: string;
    };
}

export function usePatientProfile() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<PatientProfile | null>(
        '/api/patient/me',
        async (url) => {
            const res = await fetch(url);
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.error?.message || 'Failed to load profile');
            }
            // Backend returns { data: PatientProfile } or PatientProfile
            return json.data || json;
        },
        {
            revalidateOnFocus: false,
        }
    );

    const mutateProfile = async (newData?: Partial<PatientProfile> | null) => {
        if (newData === null) {
            await mutate(null, false);
        } else if (newData) {
            await mutate((current) => current ? { ...current, ...newData } : null, false);
        } else {
            await mutate();
        }
    };

    return {
        profile: data || null,
        loading: isLoading,
        error: error ? error.message : null,
        mutate: mutateProfile
    };
}
