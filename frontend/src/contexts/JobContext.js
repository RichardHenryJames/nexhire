import React, { createContext, useContext, useState, useEffect } from 'react';
import refopenAPI from '../services/api';

const JobContext = createContext();

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJobs must be used within a JobProvider');
  }
  return context;
};

export const JobProvider = ({ children }) => {
  const [jobs, setJobs] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // Load initial data
  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    try {
      const [jobTypesResult, currenciesResult] = await Promise.all([
        refopenAPI.getJobTypes(),
        refopenAPI.getCurrencies(),
      ]);

      if (jobTypesResult.success) {
        setJobTypes(jobTypesResult.data);
      }

      if (currenciesResult.success) {
        setCurrencies(currenciesResult.data);
      }
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };

  const loadJobs = async (page = 1, pageSize = 20, filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const result = await refopenAPI.getJobs(page, pageSize, filters);

      if (result.success) {
        if (page === 1) {
          setJobs(result.data);
        } else {
          setJobs(prev => [...prev, ...result.data]);
        }

        setPagination({
          page: result.meta?.page || page,
          pageSize: result.meta?.pageSize || pageSize,
          total: result.meta?.total || 0,
          totalPages: result.meta?.totalPages || 0,
        });
      } else {
        setError(result.message || 'Failed to load jobs');
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
      setError(error.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const searchJobs = async (query, filters = {}) => {
    try {
      setLoading(true);
      setError(null);

      const result = await refopenAPI.searchJobs(query, filters);

      if (result.success) {
        setJobs(result.data);
        setPagination({
          page: 1,
          pageSize: 20,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / 20),
        });
      } else {
        setError(result.message || 'Search failed');
      }
    } catch (error) {
      console.error('Error searching jobs:', error);
      setError(error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getJobById = async (jobId) => {
    try {
      const result = await refopenAPI.getJobById(jobId);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to load job details');
      }
    } catch (error) {
      console.error('Error loading job details:', error);
      throw error;
    }
  };

  const applyForJob = async (applicationData) => {
    try {
      const result = await refopenAPI.applyForJob(applicationData);
      if (result.success) {
        return result;
      } else {
        throw new Error(result.message || 'Application failed');
      }
    } catch (error) {
      console.error('Error applying for job:', error);
      throw error;
    }
  };

  const createJob = async (jobData) => {
    try {
      const result = await refopenAPI.createJob(jobData);
      if (result.success) {
        // Refresh jobs list
        await loadJobs(1);
        return result;
      } else {
        throw new Error(result.message || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  };

  const clearError = () => {
    setError(null);
  };

  const refreshJobs = () => {
    loadJobs(1);
  };

  const loadMore = () => {
    if (pagination.page < pagination.totalPages && !loading) {
      loadJobs(pagination.page + 1);
    }
  };

  const value = {
    // State
    jobs,
    jobTypes,
    currencies,
    loading,
    error,
    pagination,

    // Actions
    loadJobs,
    searchJobs,
    getJobById,
    applyForJob,
    createJob,
    clearError,
    refreshJobs,
    loadMore,

    // Computed values
    hasMore: pagination.page < pagination.totalPages,
    isEmpty: jobs.length === 0 && !loading,
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};