import ApiService from '../API/apiServices';

export type ApiFixture = {
    apiService: ApiService;
};

export const apiFixture = {
    apiService: async ({ }: any, use: (r: ApiService) => Promise<void>) => {
        const api = new ApiService();
        await use(api);
    }
};
