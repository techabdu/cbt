<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAcademicSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'session'    => ['required', 'string', 'regex:/^\d{4}\/\d{4}$/',
                Rule::unique('academic_sessions', 'session')->where('school_id', $schoolId)],
            'is_current' => ['sometimes', 'boolean'],
        ];
    }
}
