//go:build unit

package service

import (
	"context"
	"testing"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestAPIKeyService_UpdateGroup_PreservesOtherFields(t *testing.T) {
	oldGroupID := int64(5)
	existing := &APIKey{
		ID:          1,
		UserID:      42,
		Key:         "sk-test",
		Name:        "Stable",
		GroupID:     &oldGroupID,
		Status:      StatusActive,
		IPWhitelist: []string{"192.0.2.1"},
		IPBlacklist: []string{"198.51.100.0/24"},
		Quota:       12,
		QuotaUsed:   3,
		RateLimit5h: 4,
		RateLimit1d: 5,
		RateLimit7d: 6,
	}
	apiKeyRepo := &apiKeyRepoStubForGroupUpdate{key: existing}
	groupRepo := &groupRepoStubForGroupUpdate{group: &Group{ID: 10, Name: "Pro", Status: StatusActive}}
	userRepo := &userRepoStubForGroupUpdate{}
	svc := NewAPIKeyService(apiKeyRepo, userRepo, groupRepo, nil, nil, nil, nil)

	got, err := svc.UpdateGroup(context.Background(), 1, 42, int64Ptr(10))
	require.NoError(t, err)

	require.NotNil(t, got.GroupID)
	require.Equal(t, int64(10), *got.GroupID)
	require.Equal(t, "Stable", got.Name)
	require.Equal(t, []string{"192.0.2.1"}, got.IPWhitelist)
	require.Equal(t, []string{"198.51.100.0/24"}, got.IPBlacklist)
	require.Equal(t, 12.0, got.Quota)
	require.Equal(t, 3.0, got.QuotaUsed)
	require.Equal(t, 4.0, got.RateLimit5h)
	require.Equal(t, 5.0, got.RateLimit1d)
	require.Equal(t, 6.0, got.RateLimit7d)
	require.NotNil(t, apiKeyRepo.updated)
	require.Equal(t, []string{"192.0.2.1"}, apiKeyRepo.updated.IPWhitelist)
}

func TestAPIKeyService_UpdateGroup_UnbindsWithZero(t *testing.T) {
	oldGroupID := int64(5)
	existing := &APIKey{ID: 1, UserID: 42, Key: "sk-test", GroupID: &oldGroupID, Group: &Group{ID: oldGroupID}, Status: StatusActive}
	apiKeyRepo := &apiKeyRepoStubForGroupUpdate{key: existing}
	svc := NewAPIKeyService(apiKeyRepo, nil, nil, nil, nil, nil, nil)

	got, err := svc.UpdateGroup(context.Background(), 1, 42, int64Ptr(0))
	require.NoError(t, err)
	require.Nil(t, got.GroupID)
	require.Nil(t, got.Group)
	require.NotNil(t, apiKeyRepo.updated)
	require.Nil(t, apiKeyRepo.updated.GroupID)
}

func TestAPIKeyService_UpdateGroup_RejectsUnauthorizedOwner(t *testing.T) {
	existing := &APIKey{ID: 1, UserID: 7, Key: "sk-test", Status: StatusActive}
	apiKeyRepo := &apiKeyRepoStubForGroupUpdate{key: existing}
	svc := NewAPIKeyService(apiKeyRepo, nil, nil, nil, nil, nil, nil)

	_, err := svc.UpdateGroup(context.Background(), 1, 42, int64Ptr(10))
	require.ErrorIs(t, err, ErrInsufficientPerms)
	require.Nil(t, apiKeyRepo.updated)
}

func TestAPIKeyService_UpdateGroup_RejectsUnavailableGroup(t *testing.T) {
	existing := &APIKey{ID: 1, UserID: 42, Key: "sk-test", Status: StatusActive}
	apiKeyRepo := &apiKeyRepoStubForGroupUpdate{key: existing}
	groupRepo := &groupRepoStubForGroupUpdate{group: &Group{ID: 10, Name: "Off", Status: StatusDisabled}}
	userRepo := &userRepoStubForGroupUpdate{}
	svc := NewAPIKeyService(apiKeyRepo, userRepo, groupRepo, nil, nil, nil, nil)

	_, err := svc.UpdateGroup(context.Background(), 1, 42, int64Ptr(10))
	require.Error(t, err)
	require.Equal(t, "GROUP_NOT_ACTIVE", infraerrors.Reason(err))
	require.Nil(t, apiKeyRepo.updated)
}
